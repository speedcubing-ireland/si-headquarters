import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api, internal } from "@/convex/_generated/api"
import type { MutationCtx } from "@/convex/_generated/server"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankProject,
  insertProjectPhase,
  insertSeedTask,
} from "@/convex/testHelpers"
import { TASK_LABEL_CODES } from "@/convex/tasks/labels/constants"

async function insertLinkedUser(
  ctx: MutationCtx,
  name: string,
  discordUserId: string
) {
  return await ctx.db.insert("users", {
    name,
    discordUserId,
    discordUsername: name.toLowerCase().replaceAll(" ", "_"),
    discordDisplayName: name,
    discordLinkedAt: Date.now(),
  })
}

describe("project workflows", () => {
  test("removing a workflow deletes its installation and runs", async () => {
    const t = convexTest(schema, modules)
    const { projectId, leadId } = await t.run(async (ctx) => {
      const leadId = await insertLinkedUser(ctx, "Project Lead", "discord-lead")
      const projectId = await insertBlankProject(ctx)
      await ctx.db.patch("projects", projectId, { leadUserId: leadId })
      return { projectId, leadId }
    })
    const asLead = t.withIdentity({ subject: leadId })

    const workflowId = await asLead.mutation(
      api.projectWorkflows.mutations.install,
      {
        projectId,
        workflowId: "certificates.ordering",
      }
    )
    const runId = await asLead.mutation(api.projectWorkflows.mutations.runNow, {
      id: workflowId,
    })

    await asLead.mutation(api.projectWorkflows.mutations.remove, {
      id: workflowId,
    })

    const { installation, run } = await t.run(async (ctx) => ({
      installation: await ctx.db.get("projectWorkflows", workflowId),
      run: await ctx.db.get("workflowRuns", runId),
    }))
    expect(installation).toBeNull()
    expect(run).toBeNull()
  })

  test("certificate workflow flags certificate-labelled project tasks for the project lead", async () => {
    const t = convexTest(schema, modules)
    const { projectId, leadId } = await t.run(async (ctx) => {
      const leadId = await insertLinkedUser(ctx, "Project Lead", "discord-lead")
      const projectId = await insertBlankProject(ctx)
      await ctx.db.patch("projects", projectId, { leadUserId: leadId })
      const phaseId = await insertProjectPhase(ctx, projectId, "Ordering", "a")
      const taskId = await insertSeedTask(ctx, {
        name: "Order certificates",
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "to-do",
      })
      await ctx.db.patch("tasks", taskId, { dueDate: "2026-06-20" })
      const labelId = await ctx.db.insert("taskLabels", {
        code: TASK_LABEL_CODES.certificates,
        name: "Certificates",
        color: "sky",
      })
      await ctx.db.insert("taskLabelAssignments", { taskId, labelId })
      return { projectId, leadId }
    })
    const asLead = t.withIdentity({ subject: leadId })

    const workflowId = await asLead.mutation(
      api.projectWorkflows.mutations.install,
      {
        projectId,
        workflowId: "certificates.ordering",
        config: { kind: "certificates.ordering", leadTimeDays: 30 },
      }
    )
    const runId = await asLead.mutation(api.projectWorkflows.mutations.runNow, {
      id: workflowId,
    })
    await t.action(internal.projectWorkflows.runner.runProjectWorkflow, {
      runId,
    })

    const run = await t.run(async (ctx) => ctx.db.get("workflowRuns", runId))
    expect(run?.status).toBe("attention")
    expect(run?.summary).toContain("Order certificates")

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "projectWorkflowAttention",
          projectId,
          workflowRunId: runId,
        },
      }
    )

    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.target).toEqual({
      kind: "discordUser",
      discordUserId: "discord-lead",
    })
    expect(drafts[0]?.embeds[0]?.fields?.[0]?.value).toContain(
      "Order certificates"
    )
  })
})
