/// <reference types="vite/client" />

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import schema from "@/convex/schema"
import { ensureVolunteerMembership } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

describe("competition queries", () => {
  test("people query hydrates competition people independently", async () => {
    const t = convexTest(schema, modules)
    const { viewerId, competitionId, compLeadId, leadDelegateId, organiserId } =
      await t.run(async (ctx) => {
        const viewerId = await ctx.db.insert("users", {
          name: "Viewer",
        })
        await ensureVolunteerMembership(ctx, viewerId)
        const compLeadId = await ctx.db.insert("users", {
          name: "Comp Lead",
        })
        const leadDelegateId = await ctx.db.insert("users", {
          name: "Lead Delegate",
        })
        const organiserId = await ctx.db.insert("users", {
          name: "Organiser",
        })
        const competitionId = await ctx.db.insert("competitions", {
          name: "Spring Open",
          description: null,
          people: {
            compLead: compLeadId,
            leadDelegate: leadDelegateId,
            organisers: [organiserId],
          },
          compDates: {
            from: null,
            to: null,
          },
          phaseId: null,
          updateId: null,
        })

        return {
          viewerId,
          competitionId,
          compLeadId,
          leadDelegateId,
          organiserId,
        }
      })
    const viewer = t.withIdentity({ subject: viewerId })

    const people = await viewer.query(api.competitions.queries.getPeople, {
      id: competitionId,
    })

    expect(people.competition._id).toBe(competitionId)
    expect(people.people.compLead?._id).toBe(compLeadId)
    expect(people.people.leadDelegate?._id).toBe(leadDelegateId)
    expect(people.people.organisers.map((user) => user._id)).toEqual([
      organiserId,
    ])
  })

  test("current update query returns update author and handles empty updates", async () => {
    const t = convexTest(schema, modules)
    const {
      viewerId,
      competitionWithUpdateId,
      competitionWithoutUpdateId,
      authorId,
    } = await t.run(async (ctx) => {
      const viewerId = await ctx.db.insert("users", {
        name: "Viewer",
      })
      await ensureVolunteerMembership(ctx, viewerId)
      const authorId = await ctx.db.insert("users", {
        name: "Update Author",
      })
      const competitionWithUpdateId = await insertCompetition(ctx, "With")
      const competitionWithoutUpdateId = await insertCompetition(ctx, "Empty")
      const updateId = await ctx.db.insert("competitionUpdates", {
        competitionId: competitionWithUpdateId,
        authorId,
        body: "Hello world",
        editedAt: 1,
      })
      await ctx.db.patch("competitions", competitionWithUpdateId, {
        updateId,
      })

      return {
        viewerId,
        competitionWithUpdateId,
        competitionWithoutUpdateId,
        authorId,
      }
    })
    const viewer = t.withIdentity({ subject: viewerId })

    const withUpdate = await viewer.query(
      api.competitions.queries.getCurrentUpdate,
      {
        id: competitionWithUpdateId,
      }
    )
    const withoutUpdate = await viewer.query(
      api.competitions.queries.getCurrentUpdate,
      {
        id: competitionWithoutUpdateId,
      }
    )

    expect(withUpdate.update?.body).toBe("Hello world")
    expect(withUpdate.update?.author?._id).toBe(authorId)
    expect(withoutUpdate.update).toBeNull()
  })
})

async function insertCompetition(
  ctx: MutationCtx,
  name: string
): Promise<Id<"competitions">> {
  return await ctx.db.insert("competitions", {
    name,
    description: null,
    people: {
      compLead: null,
      leadDelegate: null,
      organisers: [],
    },
    compDates: {
      from: null,
      to: null,
    },
    phaseId: null,
    updateId: null,
  })
}
