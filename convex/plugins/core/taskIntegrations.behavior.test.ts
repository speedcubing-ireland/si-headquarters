import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  addUserToTeam,
  insertBlankCompetition,
  insertCompetitionPhase,
  insertSeedTask,
  insertTestUser,
} from "@/convex/testHelpers"
import { TEAM_NAMES } from "@/convex/permissions/shared"

describe("task integrations", () => {
  test("organiser can attach and detach integrations on competition tasks", async () => {
    const t = convexTest(schema, modules)
    const { userId, taskId } = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [userId],
        },
      })
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Ops",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        name: "Certs",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      return { userId, taskId }
    })
    const asOrganiser = t.withIdentity({ subject: userId })

    const integrationRowId = await asOrganiser.mutation(
      api.plugins.core.taskIntegrations.attach,
      {
        taskId,
        integrationId: "canva.certificates",
      }
    )

    const listed = await asOrganiser.query(
      api.plugins.core.taskIntegrations.listForTask,
      { taskId }
    )
    expect(listed).toHaveLength(1)
    expect(listed[0]?.integrationId).toBe("canva.certificates")
    expect(listed[0]?.definition).toEqual({
      id: "canva.certificates",
      label: "Certificate designs",
      pluginId: "canva",
    })

    await asOrganiser.mutation(api.plugins.core.taskIntegrations.detach, {
      id: integrationRowId,
    })

    const afterDetach = await asOrganiser.query(
      api.plugins.core.taskIntegrations.listForTask,
      { taskId }
    )
    expect(afterDetach).toHaveLength(0)
  })

  test("same task can attach multiple Canva variations", async () => {
    const t = convexTest(schema, modules)
    const { userId, taskId } = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [userId],
        },
      })
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Design",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        name: "Event designs",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      return { userId, taskId }
    })
    const asOrganiser = t.withIdentity({ subject: userId })

    await asOrganiser.mutation(api.plugins.core.taskIntegrations.attach, {
      taskId,
      integrationId: "canva.certificates",
    })
    await asOrganiser.mutation(api.plugins.core.taskIntegrations.attach, {
      taskId,
      integrationId: "canva.lanyards",
    })

    const listed = await asOrganiser.query(
      api.plugins.core.taskIntegrations.listForTask,
      { taskId }
    )
    expect(listed.map((row) => row.integrationId).sort()).toEqual([
      "canva.certificates",
      "canva.lanyards",
    ])
  })

  test("exposes unattached integrations for the task add menu", async () => {
    const t = convexTest(schema, modules)
    const { userId, taskId } = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [userId],
        },
      })
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Ops",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        name: "Certs",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      return { userId, taskId }
    })
    const asOrganiser = t.withIdentity({ subject: userId })
    const available = await asOrganiser.query(
      api.plugins.core.taskIntegrations.listAvailableForTask,
      { taskId }
    )
    expect(available.map((d) => d.id).sort()).toEqual(
      [
        "canva.certificates",
        "canva.lanyards",
        "sheet.populate-checkin",
        "sheet.transfer-schedule-to-wca",
      ].sort()
    )
  })

  test("rejects starting a run while integration is already running", async () => {
    const t = convexTest(schema, modules)
    const { userId, integrationRowId } = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [userId],
        },
      })
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Ops",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        name: "Certs",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const integrationRowId = await ctx.db.insert("taskIntegrations", {
        taskId,
        integrationId: "canva.certificates",
        status: "running",
        lastMessage: null,
        lastRunAt: Date.now(),
        runId: "existing-run",
        output: null,
      })
      return { userId, integrationRowId }
    })

    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.plugins.core.taskIntegrations.run, {
          id: integrationRowId,
        })
    ).rejects.toThrow(/already running/)
  })

  test("attaches configured template integrations when tasks are created", async () => {
    const t = convexTest(schema, modules)
    const { userId, taskId } = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Organiser")
      await addUserToTeam(ctx, userId, TEAM_NAMES.VOLUNTEER)
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [userId],
        },
      })
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Ops",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        name: "Order certificates",
        parent: { type: "phases", id: phaseId },
        order: "a",
        integrationIds: ["canva.certificates"],
      })
      await insertSeedTask(ctx, {
        name: "Order certificates duplicate check",
        parent: { type: "phases", id: phaseId },
        order: "b",
        integrationIds: [],
      })
      return { userId, taskId }
    })

    const listed = await t
      .withIdentity({ subject: userId })
      .query(api.plugins.core.taskIntegrations.listForTask, { taskId })
    expect(listed.map((row) => row.integrationId)).toEqual([
      "canva.certificates",
    ])
  })
})
