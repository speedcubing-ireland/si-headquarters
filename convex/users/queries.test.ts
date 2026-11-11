/// <reference types="vite/client" />

import type { FunctionReturnType } from "convex/server"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import {
  addUserToTeam,
  insertBlankCompetition,
  insertBlankProject,
  insertCompetitionPhase,
  insertSeedTask,
  insertTestUser,
  seedVolunteerTestUser,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import type { Id } from "@/convex/_generated/dataModel"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { toPublicUser } from "@/convex/users/queries"

const testUserId = "10000;users" as Id<"users">

describe("toPublicUser", () => {
  test("resolves Discord avatar over auth image when linked", () => {
    const publicUser = toPublicUser({
      _id: testUserId,
      name: "Test User",
      image: "https://example.com/google.png",
      discordUserId: "123",
      discordAvatarHash: "abc",
    })
    expect(publicUser.image).toBe(
      "https://cdn.discordapp.com/avatars/123/abc.png?size=128"
    )
  })

  test("keeps auth image when Discord is not linked", () => {
    const publicUser = toPublicUser({
      _id: testUserId,
      name: "Test User",
      image: "https://example.com/google.png",
      discordUserId: undefined,
      discordAvatarHash: undefined,
    })
    expect(publicUser.image).toBe("https://example.com/google.png")
  })
})

describe("users.list public avatars", () => {
  test("returns Discord avatar URL for linked users", async () => {
    const t = convexTest(schema, modules)
    const { volunteerId, linkedUserId } = await t.run(async (ctx) => {
      const volunteerId = await seedVolunteerTestUser(ctx)
      const linkedUserId = await seedVolunteerTestUser(ctx, "Linked User")
      await ctx.db.patch("users", linkedUserId, {
        image: "https://example.com/google.png",
        discordUserId: "123",
        discordAvatarHash: "abc",
      })
      return { volunteerId, linkedUserId }
    })

    const volunteer = t.withIdentity({ subject: volunteerId })
    const users = await volunteer.query(api.users.queries.list, {
      paginationOpts: { numItems: 50, cursor: null },
    })
    const linked = users.page.find((user) => user._id === linkedUserId)

    expect(linked?.image).toBe(
      "https://cdn.discordapp.com/avatars/123/abc.png?size=128"
    )
  })
})

describe("user selector eligibility", () => {
  test("task participants can resolve saved selections but not unrelated users", async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
      const viewer = await insertTestUser(ctx, "Assignee")
      const owner = await insertTestUser(ctx, "Disabled owner")
      const unrelated = await insertTestUser(ctx, "Unrelated disabled user")
      for (const id of [owner, unrelated])
        await ctx.db.patch("users", id, {
          disabled: true,
          image: "https://example.com/private-avatar.png",
        })
      const competition = await insertBlankCompetition(ctx)
      const otherCompetition = await insertBlankCompetition(ctx)
      const phase = await insertCompetitionPhase(ctx, competition, "Setup", "a")
      const task = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phase },
        order: "a",
      })
      await ctx.db.patch("tasks", task, {
        assigneeIds: [viewer],
        owner: { type: "users", id: owner },
      })
      return { viewer, owner, unrelated, task, otherCompetition }
    })
    const viewer = t.withIdentity({ subject: ids.viewer })
    await expect(
      viewer.query(api.users.queries.listScopeOrganisers, {
        scope: { type: "tasks", id: ids.task },
      })
    ).rejects.toThrow()
    expect(
      await viewer.query(api.users.queries.getSelected, {
        scope: { type: "tasks", id: ids.task },
        userIds: [ids.viewer, ids.owner, ids.unrelated],
      })
    ).toEqual([
      expect.objectContaining({ _id: ids.viewer, name: "Assignee" }),
      expect.objectContaining({ _id: ids.owner, name: "Disabled owner" }),
    ])
    for (const scope of [
      undefined,
      { type: "competitions", id: ids.otherCompetition },
    ] as const) {
      await expect(
        viewer.query(api.users.queries.getSelected, {
          scope,
          userIds: [ids.owner],
        })
      ).rejects.toThrow()
    }
  })

  test("team project viewers can resolve only the saved lead and direct user members", async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
      const viewer = await insertTestUser(ctx, "Team viewer")
      await addUserToTeam(ctx, viewer, TEAM_NAMES.GRAPHICS)
      const team = await ctx.db
        .query("teams")
        .withIndex("by_name", (q) => q.eq("name", TEAM_NAMES.GRAPHICS))
        .unique()
      if (team === null) throw new Error("Missing graphics team")
      const lead = await insertTestUser(ctx, "Lead")
      const member = await insertTestUser(ctx, "Disabled member")
      const unrelated = await insertTestUser(ctx, "Unrelated")
      await ctx.db.patch("users", member, { disabled: true })
      const project = await insertBlankProject(ctx, {
        type: "teams",
        id: team._id,
      })
      await ctx.db.patch("projects", project, { leadUserId: lead })
      await ctx.db.insert("projectMembers", {
        projectId: project,
        member: { type: "users", id: member },
      })
      return { viewer, lead, member, unrelated, project }
    })
    const args = {
      scope: { type: "projects" as const, id: ids.project },
      userIds: [ids.lead, ids.member, ids.unrelated],
    }
    const viewer = t.withIdentity({ subject: ids.viewer })
    expect(
      (await viewer.query(api.users.queries.getSelected, args)).map(
        (user) => user._id
      )
    ).toEqual([ids.lead, ids.member])
    // An editor must still resolve an unsaved choice before saving it.
    expect(
      (
        await t
          .withIdentity({ subject: ids.lead })
          .query(api.users.queries.getSelected, args)
      ).map((user) => user._id)
    ).toEqual(args.userIds)
  })

  test("global options contain enabled volunteers only; selected lookup retains disabled users", async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
      const actor = await seedVolunteerTestUser(ctx)
      const enabled = await seedVolunteerTestUser(ctx, "Enabled")
      const disabled = await seedVolunteerTestUser(ctx, "Disabled")
      await ctx.db.patch("users", disabled, { disabled: true })
      const organiser = await insertTestUser(ctx, "Organiser only")
      return { actor, enabled, disabled, organiser }
    })
    const client = t.withIdentity({ subject: ids.actor })
    const users = await client.query(api.users.queries.list, {
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(new Set(users.page.map((user) => user._id))).toEqual(
      new Set([ids.actor, ids.enabled])
    )
    expect(
      await client.query(api.users.queries.getSelected, {
        userIds: [ids.disabled, ids.disabled, "invalid-id"],
      })
    ).toEqual([expect.objectContaining({ _id: ids.disabled })])
    await expect(
      t
        .withIdentity({ subject: ids.organiser })
        .query(api.users.queries.getSelected, {
          userIds: [ids.disabled],
        })
    ).rejects.toThrow()
  })

  test("directory membership and competition organisers remain separate and exclude disabled users", async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
      const actor = await seedVolunteerTestUser(ctx)
      await addUserToTeam(ctx, actor, TEAM_NAMES.COMPETITIONS)
      const organiser = await insertTestUser(ctx, "Organiser")
      const disabled = await insertTestUser(ctx, "Disabled organiser")
      await ctx.db.patch("users", disabled, { disabled: true })
      const unrelated = await insertTestUser(ctx, "Unrelated organiser")
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [actor, organiser, disabled],
        },
      })
      const otherCompetitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", otherCompetitionId, {
        people: { compLead: null, leadDelegate: null, organisers: [unrelated] },
      })
      return { actor, organiser, unrelated, competitionId }
    })
    const client = t.withIdentity({ subject: ids.actor })
    const users = await client.query(api.users.queries.list, {
      scope: { type: "competitions", id: ids.competitionId },
      paginationOpts: { numItems: 50, cursor: null },
    })
    expect(users.page.map((user) => user._id)).toEqual([ids.actor])
    expect(
      (
        await client.query(api.users.queries.listScopeOrganisers, {
          scope: { type: "competitions", id: ids.competitionId },
        })
      )
        .map((user) => user._id)
        .sort()
    ).toEqual([ids.actor, ids.organiser].sort())
    await expect(
      t
        .withIdentity({ subject: ids.unrelated })
        .query(api.users.queries.listScopeOrganisers, {
          scope: { type: "competitions", id: ids.competitionId },
        })
    ).rejects.toThrow()
    expect(
      (
        await client.query(api.users.queries.list, {
          scope: { type: "competitions", id: ids.competitionId },
          paginationOpts: { numItems: 50, cursor: null },
          teamName: TEAM_NAMES.COMPETITIONS,
        })
      ).page
    ).toEqual([expect.objectContaining({ _id: ids.actor })])
  })

  test("team-specific options exclude disabled members", async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
      const actor = await seedVolunteerTestUser(ctx)
      const enabled = await seedVolunteerTestUser(ctx, "Delegate")
      const disabled = await seedVolunteerTestUser(ctx, "Disabled delegate")
      for (const id of [enabled, disabled])
        await addUserToTeam(ctx, id, TEAM_NAMES.DELEGATES)
      await ctx.db.patch("users", disabled, { disabled: true })
      return { actor, enabled }
    })
    const users = await t
      .withIdentity({ subject: ids.actor })
      .query(api.users.queries.list, {
        teamName: TEAM_NAMES.DELEGATES,
        paginationOpts: { numItems: 50, cursor: null },
      })
    expect(users.page.map((user) => user._id)).toEqual([ids.enabled])
  })

  test("paginates past disabled historical members without capping the directory", async () => {
    const t = convexTest(schema, modules)
    const { actor, target } = await t.run(async (ctx) => {
      const actor = await seedVolunteerTestUser(ctx)
      const team = await ctx.db
        .query("teams")
        .withIndex("by_name", (q) => q.eq("name", TEAM_NAMES.VOLUNTEER))
        .unique()
      if (team === null) throw new Error("Missing volunteer team")
      for (let index = 0; index < 1001; index++) {
        const userId = await ctx.db.insert("users", {
          name: `Disabled ${String(index)}`,
          disabled: true,
        })
        await ctx.db.insert("teamMemberships", { teamId: team._id, userId })
      }
      const target = await seedVolunteerTestUser(
        ctx,
        "Another active volunteer"
      )
      return { actor, target }
    })
    const client = t.withIdentity({ subject: actor })
    const found = new Set<Id<"users">>()
    let cursor: string | null = null
    let pages = 0
    do {
      const result: FunctionReturnType<typeof api.users.queries.list> =
        await client.query(api.users.queries.list, {
          paginationOpts: { numItems: 50, cursor },
        })
      expect(result.page.length).toBeLessThanOrEqual(51)
      for (const user of result.page) found.add(user._id)
      pages++
      if (!result.isDone) expect(result.continueCursor).not.toBe(cursor)
      cursor = result.isDone ? null : result.continueCursor
    } while (cursor !== null)
    expect(pages).toBeGreaterThan(20)
    expect(found).toEqual(new Set([actor, target]))
  })
})
