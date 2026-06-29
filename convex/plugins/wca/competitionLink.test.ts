import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

describe("WCA competition links", () => {
  test("updates the competition and linked resource atomically", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await t.run((ctx) =>
      ctx.db.insert("competitions", {
        name: "Irish Open",
        description: null,
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [],
        },
        compDates: { from: "2026-09-12", to: "2026-09-13" },
        phaseId: null,
      })
    )

    const resourceId = await t.mutation(
      internal.plugins.wca.competitionLink.saveCompetitionLink,
      {
        competitionId,
        wcaCompetitionId: "IrishOpen2026",
        name: "Irish Open 2026",
        url: "https://www.worldcubeassociation.org/competitions/IrishOpen2026",
      }
    )

    const state = await t.run(async (ctx) => ({
      competition: await ctx.db.get("competitions", competitionId),
      resource: await ctx.db.get("objectLinkedResources", resourceId),
    }))
    expect(state.competition?.wcaCompetitionId).toBe("IrishOpen2026")
    expect(state.resource).toMatchObject({
      object: { type: "competitions", id: competitionId },
      resourceType: "wcaCompetition",
      resourceKey: "default",
      data: {
        resourceType: "wcaCompetition",
        wcaCompetitionId: "IrishOpen2026",
        name: "Irish Open 2026",
        url: "https://www.worldcubeassociation.org/competitions/IrishOpen2026",
      },
    })
  })
})
