import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankCompetition,
  insertCompetitionPhase,
  insertSeedTask,
} from "@/convex/testHelpers"

describe("canva task integration mutations", () => {
  test("rejects linking a design while the integration is running", async () => {
    const t = convexTest(schema, modules)
    const integrationRowId = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Design",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        name: "Certificates",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      return await ctx.db.insert("taskIntegrations", {
        taskId,
        integrationId: "canva.certificates",
        status: "running",
        lastMessage: null,
        lastRunAt: Date.now(),
        runId: "run-in-flight",
        output: null,
      })
    })

    await expect(
      t.mutation(internal.plugins.canva.mutations.applyLinkedCanvaDesign, {
        integrationRowId,
        designId: "DAF123",
        designUrl: "https://www.canva.com/design/DAF123/edit",
      })
    ).rejects.toThrow(/running/)
  })
})
