/// <reference types="vite/client" />

import { api, internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { TASK_INTEGRATION_IDS } from "@/convex/integrations/taskIntegrations/constants"
import schema from "@/convex/schema"
import { addUserToTeam, insertTestUser } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { ensureTeamByName } from "@/convex/teams/model"
import { convexTest } from "convex-test"
import { describe, expect, test, vi } from "vitest"
import { competitionTemplates } from "@/convex/templates/registry"
import type { CompetitionTemplateTaskSpec } from "@/convex/templates/registry"

// Apply templates with every feature enabled so integration-bearing task specs
// resolve, independent of which features the shipped manifest gates on.
vi.mock(
  "@/config/lib/organisation",
  () => import("@/config/lib/organisation.testFixture")
)

const STANDARD_TEMPLATE = {
  templateKey: "standard-competition" as const,
  variables: {},
}

async function seedTemplateActors() {
  const t = convexTest(schema, modules)
  const seeded = await t.run(async (ctx) => {
    const actorId = await insertTestUser(ctx, "Competition Manager")
    const compLeadId = await insertTestUser(ctx, "Competition Lead")
    const delegateId = await insertTestUser(ctx, "Lead Delegate")
    const organiserId = await insertTestUser(ctx, "Organiser")

    await addUserToTeam(ctx, actorId, TEAM_NAMES.COMPETITIONS)
    await addUserToTeam(ctx, compLeadId, TEAM_NAMES.COMPETITIONS)
    await addUserToTeam(ctx, delegateId, TEAM_NAMES.DELEGATES)
    await ensureTeamByName(ctx, TEAM_NAMES.SOCIAL_MEDIA)
    await ensureTeamByName(ctx, TEAM_NAMES.GRAPHICS)
    await ensureTeamByName(ctx, TEAM_NAMES.FINANCE)
    await ensureTeamByName(ctx, TEAM_NAMES.MERCH)

    return { actorId, compLeadId, delegateId, organiserId }
  })

  return { t, actor: t.withIdentity({ subject: seeded.actorId }), ...seeded }
}

async function insertEmptyCompetition(
  t: Awaited<ReturnType<typeof seedTemplateActors>>["t"],
  people: {
    compLead: Id<"users"> | null
    leadDelegate: Id<"users"> | null
    organisers?: Id<"users">[]
  }
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("competitions", {
      name: "Spring Open 2027",
      description: null,
      people: {
        compLead: people.compLead,
        leadDelegate: people.leadDelegate,
        organisers: people.organisers ?? [],
      },
      compDates: { from: "2027-03-20", to: "2027-03-21" },
      phaseId: null,
    })
  })
}

describe("competition templates", () => {
  test("only references registered task integration ids", () => {
    const registeredIds = new Set<string>(TASK_INTEGRATION_IDS)
    const templateIds: string[] = []

    function collectTaskIds(task: CompetitionTemplateTaskSpec) {
      templateIds.push(...(task.integrationIds ?? []))
      for (const subtask of task.subtasks ?? []) collectTaskIds(subtask)
    }

    for (const template of competitionTemplates) {
      for (const phase of template.phases) {
        for (const task of phase.tasks ?? []) collectTaskIds(task)
      }
    }

    expect(templateIds.length).toBeGreaterThan(0)
    expect(templateIds.filter((id) => !registeredIds.has(id))).toEqual([])
  })

  test("lists the normal competition template without required variables", async () => {
    const { actor } = await seedTemplateActors()

    const templates = await actor.query(
      api.templates.queries.listCompetitionTemplates,
      {}
    )
    const standard = templates.find(
      (template) => template.key === STANDARD_TEMPLATE.templateKey
    )
    expect(standard?.name).toBe("Normal Competition")
    expect(standard?.variables).toEqual([])
  })

  test("creates a competition from the standard template", async () => {
    const { actor, compLeadId, delegateId, organiserId, t } =
      await seedTemplateActors()

    const competitionId = await actor.mutation(
      api.competitions.mutations.createFromTemplate,
      {
        templateKey: STANDARD_TEMPLATE.templateKey,
        name: "Spring Open 2027",
        description: "",
        compDates: { from: "2027-03-20", to: "2027-03-21" },
        people: {
          compLead: compLeadId,
          leadDelegate: delegateId,
          organisers: [organiserId],
        },
        variables: STANDARD_TEMPLATE.variables,
      }
    )

    const stored = await t.run(async (ctx) => {
      const competition = await ctx.db.get("competitions", competitionId)
      const phases = await ctx.db
        .query("phases")
        .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
          q.eq("owner.type", "competitions").eq("owner.id", competitionId)
        )
        .collect()
      const tasks = await ctx.db.query("tasks").collect()
      const phaseTasks = tasks.filter((task) => task.parent.type === "phases")
      const taskByName = new Map(tasks.map((task) => [task.name, task]))
      const reviewers = await ctx.db.query("taskReviewers").collect()
      const integrations = await ctx.db.query("taskIntegrations").collect()
      const blockers = await ctx.db.query("taskBlockers").collect()

      const blockingTaskNames = (blockedTaskId: string) =>
        blockers
          .filter((row) => row.blockedTaskId === blockedTaskId)
          .map((row) => {
            const task = tasks.find((entry) => entry._id === row.blockingTaskId)
            return task?.name ?? null
          })
          .filter((name): name is string => name !== null)
          .sort()

      const venueBooked = taskByName.get("Venue booked")
      const lanyardsDesigned = taskByName.get("Lanyards designed")
      const checkInSheetReady = taskByName.get("Check-in sheet ready")

      return {
        blockers,
        checkInSheetReadyTaskId: checkInSheetReady?._id ?? null,
        competition,
        integrations,
        lanyardsDesignedTaskId: lanyardsDesigned?._id ?? null,
        phaseNames: phases.map((phase) => phase.name),
        phaseTasks,
        reviewerCount: reviewers.length,
        scheduleTask: taskByName.get("Schedule made"),
        sponsorshipBlockers: blockingTaskNames(
          taskByName.get("Sponsorship")?._id ?? ""
        ),
        printingCompleteBlockers: blockingTaskNames(
          taskByName.get("Printing Complete")?._id ?? ""
        ),
        preCompEmailBlockers: blockingTaskNames(
          taskByName.get("Pre-comp email written and sent")?._id ?? ""
        ),
        taskNames: tasks.map((task) => task.name),
        venueBookedKind: venueBooked?.kind ?? null,
        venueBookedReviewers: reviewers.filter(
          (row) => row.taskId === venueBooked?._id
        ).length,
      }
    })

    expect(stored.competition?.name).toBe("Spring Open 2027")
    expect(stored.phaseNames).toEqual([
      "Concept",
      "Pre-Announcement",
      "Announced",
      "Pre-Competition",
      "Post-Competition",
      "Completed",
    ])
    expect(stored.competition?.phaseId).not.toBeNull()
    expect(
      stored.phaseTasks.find((task) => task.name === "Size and venue picked")
        ?.status
    ).toBe("to-do")
    expect(stored.scheduleTask?.name).toBe("Schedule made")
    expect(stored.venueBookedKind).toBe("flow")
    expect(stored.venueBookedReviewers).toBeGreaterThan(0)
    expect(stored.reviewerCount).toBeGreaterThan(0)
    expect(stored.integrations.map((row) => row.integrationId).sort()).toEqual([
      "canva.certificates",
      "canva.lanyards",
      "sheet.populate-checkin",
      "sheet.transfer-schedule-to-wca",
    ])
    expect(
      stored.integrations.find((row) => row.integrationId === "canva.lanyards")
        ?.taskId
    ).toBe(stored.lanyardsDesignedTaskId)
    expect(
      stored.integrations.find(
        (row) => row.integrationId === "sheet.populate-checkin"
      )?.taskId
    ).toBe(stored.checkInSheetReadyTaskId)

    for (const taskName of [
      "Submit competition",
      "Podium Certificates",
      "Printing Complete",
      "Report submitted",
      "Post-Competition Social Media",
      "Discord Thread Made",
      "Groups Ready",
    ]) {
      expect(stored.taskNames).toContain(taskName)
    }

    for (const taskName of [
      "Lanyard designed",
      "Final budget filled out",
      "Podium photos posted",
      "Check-in sheet ready for registration",
      "Groups and printing done",
      "Certificates ready",
    ]) {
      expect(stored.taskNames).not.toContain(taskName)
    }

    expect(stored.sponsorshipBlockers).toEqual([
      "Schedule made",
      "Venue booked",
    ])
    expect(stored.printingCompleteBlockers).toEqual(["Groups Ready"])
    expect(stored.preCompEmailBlockers).toEqual(["Groups Ready"])
    expect(stored.blockers.length).toBe(4)
  })

  test("applies a template to an existing empty competition", async () => {
    const { compLeadId, delegateId, organiserId, t } =
      await seedTemplateActors()

    const competitionId = await insertEmptyCompetition(t, {
      compLead: compLeadId,
      leadDelegate: delegateId,
      organisers: [organiserId],
    })

    await t.mutation(internal.templates.mutations.applyToExistingCompetition, {
      competitionId,
      ...STANDARD_TEMPLATE,
    })

    const stored = await t.run(async (ctx) => {
      const competition = await ctx.db.get("competitions", competitionId)
      const phases = await ctx.db
        .query("phases")
        .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
          q.eq("owner.type", "competitions").eq("owner.id", competitionId)
        )
        .collect()
      const tasks = await ctx.db.query("tasks").collect()

      return {
        competition,
        phaseCount: phases.length,
        taskCount: tasks.length,
      }
    })

    expect(stored.competition?._id).toBe(competitionId)
    expect(stored.competition?.phaseId).not.toBeNull()
    expect(stored.phaseCount).toBe(6)
    expect(stored.taskCount).toBeGreaterThan(15)
  })

  test("blocks applying a template while phases remain", async () => {
    const { compLeadId, delegateId, t } = await seedTemplateActors()

    const competitionId = await t.run(async (ctx) => {
      const competitionId = await ctx.db.insert("competitions", {
        name: "Spring Open 2027",
        description: null,
        people: {
          compLead: compLeadId,
          leadDelegate: delegateId,
          organisers: [],
        },
        compDates: { from: "2027-03-20", to: "2027-03-21" },
        phaseId: null,
      })
      const phaseId = await ctx.db.insert("phases", {
        name: "Concept",
        owner: { type: "competitions", id: competitionId },
        sortKey: "a0",
        color: "blue",
      })
      await ctx.db.patch("competitions", competitionId, { phaseId })
      return competitionId
    })

    await expect(
      t.mutation(internal.templates.mutations.applyToExistingCompetition, {
        competitionId,
        ...STANDARD_TEMPLATE,
      })
    ).rejects.toThrow(/Remove all phases/)
  })
})
