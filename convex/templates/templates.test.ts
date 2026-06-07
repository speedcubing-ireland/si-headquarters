/// <reference types="vite/client" />

import { api } from "@/convex/_generated/api"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import schema from "@/convex/schema"
import { addUserToTeam, insertTestUser } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { ensureTeamByName } from "@/convex/teams/model"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

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

    return {
      actorId,
      compLeadId,
      delegateId,
      organiserId,
    }
  })

  return { t, actor: t.withIdentity({ subject: seeded.actorId }), ...seeded }
}

describe("competition templates", () => {
  test("lists the normal competition template without required variables", async () => {
    const { actor } = await seedTemplateActors()

    const templates = await actor.query(
      api.templates.queries.listCompetitionTemplates,
      {}
    )
    const standard = templates.find(
      (template) => template.key === "standard-competition"
    )
    expect(standard?.name).toBe("Normal Competition")
    expect(standard?.variables).toEqual([])
  })

  test("previews the standard template without variables", async () => {
    const { actor } = await seedTemplateActors()

    const preview = await actor.query(
      api.templates.queries.previewCompetitionTemplate,
      {
        templateKey: "standard-competition",
        competition: {
          name: "Spring Open 2027",
          description: null,
          compDates: { from: "2027-03-20", to: "2027-03-21" },
          people: {
            compLead: null,
            leadDelegate: null,
            organisers: [],
          },
        },
        variables: {},
      }
    )

    const conceptTasks =
      preview.phases.find((phase) => phase.key === "concept")?.tasks ?? []
    expect(conceptTasks.map((task) => task.name)).toContain(
      "Size and venue picked"
    )
    expect(preview.counts.tasks).toBeGreaterThan(15)
  })

  test("creates a competition from the standard template", async () => {
    const { actor, compLeadId, delegateId, organiserId, t } =
      await seedTemplateActors()

    const competitionId = await actor.mutation(
      api.competitions.mutations.createFromTemplate,
      {
        templateKey: "standard-competition",
        name: "Spring Open 2027",
        description: "",
        compDates: { from: "2027-03-20", to: "2027-03-21" },
        people: {
          compLead: compLeadId,
          leadDelegate: delegateId,
          organisers: [organiserId],
        },
        variables: {},
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
      const applications = await ctx.db
        .query("competitionTemplateApplications")
        .withIndex("by_competitionId", (q) =>
          q.eq("competitionId", competitionId)
        )
        .collect()

      return {
        application: applications[0],
        competition,
        integrations,
        phaseNames: phases.map((phase) => phase.name),
        phaseTasks,
        reviewerCount: reviewers.length,
        scheduleTask: taskByName.get("Schedule made"),
        venueBookedReviewers: reviewers.filter(
          (row) => row.taskId === taskByName.get("Venue booked")?._id
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
    expect(stored.venueBookedReviewers).toBeGreaterThan(0)
    expect(stored.reviewerCount).toBeGreaterThan(0)
    expect(stored.integrations.map((row) => row.integrationId).sort()).toEqual([
      "canva.certificates",
      "canva.lanyards",
      "sheet.populate-checkin",
      "sheet.transfer-schedule-to-wca",
    ])
    expect(stored.application).toBeDefined()
    expect(stored.application.templateKey).toBe("standard-competition")
    expect(stored.application.templateVersion).toBe(2)
    expect(stored.application.generatedCounts.phases).toBe(6)
    expect(stored.application.generatedCounts.tasks).toBeGreaterThan(15)
  })
})
