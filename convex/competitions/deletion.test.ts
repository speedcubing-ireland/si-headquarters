/// <reference types="vite/client" />

import { api, components } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import schema from "@/convex/schema"
import {
  addUserToTeam,
  insertBlankCompetition,
  insertCompetitionPhase,
  insertSeedTask,
  insertTestUser,
  seedDirectorUser,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import reactionsComponent from "@convex/reactions/test"
import commentsSchema from "../../node_modules/@hamzasaleemorg/convex-comments/src/component/schema"
import { convexTest } from "convex-test"
import { describe, expect, test, vi } from "vitest"

const commentsModules = import.meta.glob(
  "../../node_modules/@hamzasaleemorg/convex-comments/src/component/**/*.ts"
)

async function insertAuction(
  ctx: MutationCtx,
  input: {
    actorId: Id<"users">
    competitionId?: Id<"competitions">
    customAssociatedCompetitionId?: Id<"competitions">
    state: "active" | "closed" | "draft" | "scheduled"
  }
) {
  return await ctx.db.insert("sponsorshipAuctions", {
    ...(input.customAssociatedCompetitionId === undefined
      ? {
          subjectKind: "hq_competition" as const,
          competitionId: input.competitionId,
        }
      : {
          subjectKind: "custom" as const,
          customOffering: {
            name: "Custom package",
            descriptionMarkdown: "Custom sponsorship package",
            associatedCompetitionId: input.customAssociatedCompetitionId,
          },
        }),
    framework: "first_sealed",
    state: input.state,
    currency: "EUR",
    startsAt: Date.now() + 60_000,
    endsAt: Date.now() + 120_000,
    antiSnipingWindowMs: 60_000,
    antiSnipingExtendMs: 60_000,
    startPriceCents: 10_000,
    competitionSnapshot: {
      source: "competition_record",
      summary: {
        name: "Spring Open",
        address: "Dublin",
        startDate: "2026-04-01",
        endDate: "2026-04-02",
        eventIds: [],
      },
      fetchedAt: Date.now(),
    },
    createdById: input.actorId,
    updatedById: input.actorId,
    updatedAt: Date.now(),
  })
}

describe("competition deletion", () => {
  test("removes owned records, draft auctions, and task trees", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true })
    t.registerComponent("comments", commentsSchema, commentsModules)
    reactionsComponent.register(t)
    const seed = await t.run(async (ctx) => {
      const actorId = await seedDirectorUser(ctx)
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Planning",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const childTaskId = await insertSeedTask(ctx, {
        parent: { type: "tasks", id: taskId },
        order: "a",
      })
      await ctx.db.insert("competitionOrganiserInvites", {
        competitionId,
        tokenHash: "delete-me",
        createdByUserId: actorId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      })
      await ctx.db.insert("subscriptions", {
        userId: actorId,
        object: { type: "competitions", id: competitionId },
      })
      await ctx.db.insert("objectLinkedResources", {
        object: { type: "competitions", id: competitionId },
        resourceType: "googleSheet",
        resourceKey: "schedule",
        data: {
          resourceType: "googleSheet",
          sheetId: "sheet-1",
          title: "Schedule",
          url: "https://docs.google.com/spreadsheets/d/sheet-1",
        },
      })
      await ctx.db.insert("competitionSponsorOverrides", {
        competitionId,
        manualSponsorPropertyStatus: "none",
        updatedById: actorId,
        updatedAt: Date.now(),
      })
      const sponsorId = await ctx.db.insert("sponsors", {
        name: "Sponsor",
        email: "sponsor@example.com",
        emailNormalized: "sponsor@example.com",
        active: true,
        createdById: actorId,
        updatedById: actorId,
        updatedAt: Date.now(),
      })
      const auctionId = await insertAuction(ctx, {
        actorId,
        competitionId,
        state: "draft",
      })
      await ctx.db.insert("sponsorshipAuctionInvites", {
        auctionId,
        sponsorId,
        invitedById: actorId,
        invitedAt: Date.now(),
      })
      const retainedCompetitionId = await insertBlankCompetition(ctx)
      const retainedPhaseId = await insertCompetitionPhase(
        ctx,
        retainedCompetitionId,
        "Retained",
        "a"
      )
      return {
        actorId,
        auctionId,
        childTaskId,
        competitionId,
        phaseId,
        retainedCompetitionId,
        retainedPhaseId,
        taskId,
      }
    })
    const actor = t.withIdentity({ subject: seed.actorId })
    const updateId = await actor.mutation(api.updates.mutations.setCurrent, {
      object: { type: "competitions", id: seed.competitionId },
      body: "Delete this update.",
    })
    await actor.mutation(api.comments.mutations.add, {
      target: { type: "competitions", id: seed.competitionId },
      body: "Delete this competition comment.",
    })
    await actor.mutation(api.comments.mutations.add, {
      target: { type: "tasks", id: seed.taskId },
      body: "Delete this task comment.",
    })

    vi.useFakeTimers()
    try {
      await actor.mutation(api.competitions.mutations.deleteCompetition, {
        id: seed.competitionId,
      })
      await t.finishAllScheduledFunctions(() => vi.runAllTimers())
    } finally {
      vi.useRealTimers()
    }

    const result = await t.run(async (ctx) => ({
      competition: await ctx.db.get("competitions", seed.competitionId),
      phase: await ctx.db.get("phases", seed.phaseId),
      task: await ctx.db.get("tasks", seed.taskId),
      childTask: await ctx.db.get("tasks", seed.childTaskId),
      update: await ctx.db.get("objectUpdates", updateId),
      auction: await ctx.db.get("sponsorshipAuctions", seed.auctionId),
      organiserInvites: await ctx.db
        .query("competitionOrganiserInvites")
        .collect(),
      subscriptions: await ctx.db.query("subscriptions").collect(),
      linkedResources: await ctx.db.query("objectLinkedResources").collect(),
      sponsorOverrides: await ctx.db
        .query("competitionSponsorOverrides")
        .collect(),
      auctionInvites: await ctx.db.query("sponsorshipAuctionInvites").collect(),
      competitionCommentZone: await ctx.runQuery(
        components.comments.lib.getZone,
        { entityId: `competitions:${seed.competitionId}` }
      ),
      taskCommentZone: await ctx.runQuery(components.comments.lib.getZone, {
        entityId: `tasks:${seed.taskId}`,
      }),
      retainedCompetition: await ctx.db.get(
        "competitions",
        seed.retainedCompetitionId
      ),
      retainedPhase: await ctx.db.get("phases", seed.retainedPhaseId),
    }))

    expect(result).toMatchObject({
      competition: null,
      phase: null,
      task: null,
      childTask: null,
      update: null,
      auction: null,
      organiserInvites: [],
      subscriptions: [],
      linkedResources: [],
      sponsorOverrides: [],
      auctionInvites: [],
      competitionCommentZone: null,
      taskCommentZone: null,
    })
    expect(result.retainedCompetition).not.toBeNull()
    expect(result.retainedPhase).not.toBeNull()
  })

  test("preserves historical auctions and clears every competition association", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true })
    const seed = await t.run(async (ctx) => {
      const actorId = await seedDirectorUser(ctx)
      const competitionId = await insertBlankCompetition(ctx)
      const historicalAuctionId = await insertAuction(ctx, {
        actorId,
        competitionId,
        state: "closed",
      })
      const customAuctionId = await insertAuction(ctx, {
        actorId,
        customAssociatedCompetitionId: competitionId,
        state: "active",
      })
      const bidEventId = await ctx.db.insert("sponsorshipBidEvents", {
        auctionId: historicalAuctionId,
        amountCents: 12_000,
        isAuto: false,
        createdAt: Date.now(),
      })
      return {
        actorId,
        bidEventId,
        competitionId,
        customAuctionId,
        historicalAuctionId,
      }
    })

    await t
      .withIdentity({ subject: seed.actorId })
      .mutation(api.competitions.mutations.deleteCompetition, {
        id: seed.competitionId,
      })

    const result = await t.run(async (ctx) => ({
      bidEvent: await ctx.db.get("sponsorshipBidEvents", seed.bidEventId),
      customAuction: await ctx.db.get(
        "sponsorshipAuctions",
        seed.customAuctionId
      ),
      historicalAuction: await ctx.db.get(
        "sponsorshipAuctions",
        seed.historicalAuctionId
      ),
    }))
    expect(result.bidEvent).not.toBeNull()
    expect(result.historicalAuction).toMatchObject({
      subjectKind: "custom",
      customOffering: { name: "Spring Open" },
    })
    expect(result.historicalAuction?.competitionId).toBeUndefined()
    expect(
      result.customAuction?.customOffering?.associatedCompetitionId
    ).toBeUndefined()
  })

  test("only directors can delete competitions", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true })
    const seed = await t.run(async (ctx) => {
      const actorId = await insertTestUser(ctx, "Competition manager")
      await addUserToTeam(ctx, actorId, TEAM_NAMES.COMPETITIONS)
      return { actorId, competitionId: await insertBlankCompetition(ctx) }
    })
    const actor = t.withIdentity({ subject: seed.actorId })

    const page = await actor.query(api.competitions.queries.getPageRoot, {
      id: seed.competitionId,
    })
    expect(page?.canDelete).toBe(false)
    await expect(
      actor.mutation(api.competitions.mutations.deleteCompetition, {
        id: seed.competitionId,
      })
    ).rejects.toThrow("Directors only")
  })
})
