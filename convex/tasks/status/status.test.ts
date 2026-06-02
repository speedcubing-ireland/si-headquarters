/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import schema from "@/convex/schema"
import {
  seedVolunteerTestUser,
  withVolunteerTestClient,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import {
  buildTaskStatusView,
  previewFlowReopenForTask,
  TaskStatusLoader,
  type TaskStatus,
  type TaskStatusIntent,
} from "./resolver"

interface TaskSeed {
  name?: string
  parent: Doc<"tasks">["parent"]
  order: string
  kind?: Doc<"tasks">["kind"]
  status?: TaskStatus
}

async function insertPhase(ctx: MutationCtx): Promise<Id<"phases">> {
  const competitionId = await ctx.db.insert("competitions", {
    name: "Spring Open",
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

  return await ctx.db.insert("phases", {
    name: "Setup",
    owner: {
      type: "competitions",
      id: competitionId,
    },
    sortKey: "a",
    color: "gray",
  })
}

async function insertUser(
  ctx: MutationCtx,
  name = "Test User"
): Promise<Id<"users">> {
  return await ctx.db.insert("users", { name })
}

async function insertTask(
  ctx: MutationCtx,
  seed: TaskSeed
): Promise<Id<"tasks">> {
  const status = seed.status ?? "backlog"

  return await ctx.db.insert("tasks", {
    name: seed.name ?? `Task ${seed.order}`,
    description: null,
    parent: seed.parent,
    order: seed.order,
    assigneeIds: null,
    owner: null,
    dueDate: null,
    kind: seed.kind ?? "standard",
    status,
    statusIntent: { type: "manual", status },
  })
}

async function seedPhaseTask(
  ctx: MutationCtx,
  seed: Omit<TaskSeed, "parent">
): Promise<Id<"tasks">> {
  const phaseId = await insertPhase(ctx)
  return await insertTask(ctx, {
    ...seed,
    parent: { type: "phases", id: phaseId },
  })
}

function intentCommand(intent: TaskStatusIntent): TaskStatus | "auto" {
  return intent.type === "manual" ? intent.status : "auto"
}

describe("Task logic flow", () => {
  describe("1. Flows + backlog", () => {
    test("flows use order to choose the earliest incomplete current step and backlog future steps", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, currentStepId, futureStepId } = await t.run(
        async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "done",
          })
          const currentStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "in-progress",
          })
          const futureStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "c",
            status: "to-do",
          })
          return { flowId, currentStepId, futureStepId }
        }
      )

      await user.mutation(api.tasks.mutations.setTaskOrder, {
        id: currentStepId,
        order: "b",
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      const futureStep = await t.run(async (ctx) => {
        const task = await ctx.db.get("tasks", futureStepId)
        if (!task) throw new Error("Missing future step")
        return {
          status: task.status,
          statusIntent: intentCommand(task.statusIntent),
        }
      })

      expect(flow.parentStatusView.flow?.currentStepId).toBe(currentStepId)
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: flow.subtasks[0].task._id, status: "done" },
        { id: currentStepId, status: "in-progress" },
        { id: futureStepId, status: "backlog" },
      ])
      expect(futureStep).toEqual({
        status: "backlog",
        statusIntent: "backlog",
      })
    })

    test("flow view returns the current step and positioned step rows", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, completedStepId, currentStepId, futureStepId } =
        await t.run(async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          const completedStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "done",
          })
          const currentStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "in-progress",
          })
          const futureStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "c",
            status: "to-do",
          })

          return { flowId, completedStepId, currentStepId, futureStepId }
        })

      const flowView = await user.query(api.tasks.queries.getFlowView, {
        id: flowId,
      })

      expect(flowView.parent).toEqual({
        taskId: flowId,
        currentStepId,
        currentStepIndex: 1,
        totalSteps: 3,
      })
      expect(
        flowView.steps.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
          editable: statusView.isManuallyEditable,
        }))
      ).toEqual([
        { id: completedStepId, status: "done", editable: false },
        { id: currentStepId, status: "in-progress", editable: true },
        { id: futureStepId, status: "backlog", editable: false },
      ])
    })

    test("split task property and flow queries keep display data separate from structure", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, stepId, labelId, ownerId, assigneeId } = await t.run(
        async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          const stepId = await insertTask(ctx, {
            name: "Venue booked",
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "in-progress",
          })
          const labelId = await ctx.db.insert("taskLabels", {
            code: "venue",
            name: "Venue",
            color: "indigo",
          })
          const ownerId = await insertUser(ctx, "Owner User")
          const assigneeId = await insertUser(ctx, "Assignee User")
          await Promise.all([
            ctx.db.insert("taskLabelAssignments", {
              taskId: stepId,
              labelId,
            }),
            ctx.db.patch("tasks", stepId, {
              owner: { type: "users", id: ownerId },
              assigneeIds: [assigneeId],
              dueDate: "2026-05-25",
            }),
          ])

          return { flowId, stepId, labelId, ownerId, assigneeId }
        }
      )

      const properties = await user.query(api.tasks.queries.getProperties, {
        id: stepId,
      })
      const structure = await user.query(api.tasks.queries.getFlowStructure, {
        id: flowId,
      })
      const display = await user.query(api.tasks.queries.getFlowDisplay, {
        id: flowId,
      })

      expect(properties.labels.map((label) => label._id)).toEqual([labelId])
      expect(properties.owner?._id).toBe(ownerId)
      expect(properties.assignees.map((assignee) => assignee._id)).toEqual([
        assigneeId,
      ])
      expect(structure.steps[0].task._id).toBe(stepId)
      expect("labels" in structure.steps[0]).toBe(false)
      expect("owner" in structure.steps[0]).toBe(false)
      expect("dueDate" in structure.steps[0].task).toBe(false)
      expect(display.steps).toEqual([
        expect.objectContaining({
          taskId: stepId,
          dueDate: "2026-05-25",
          subtaskSummary: [],
          labels: [
            {
              _id: labelId,
              code: "venue",
              name: "Venue",
              color: "indigo",
            },
          ],
        }),
      ])
    })

    test("backlog flows stay paused until the parent is set to auto", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, currentStepId } = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        const currentStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "backlog",
        })
        return { flowId, currentStepId }
      })

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: flowId,
        status: "backlog",
      })
      let flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      expect(flow.parentStatusView.effectiveStatus).toBe("backlog")
      expect(flow.subtasks[0].statusView.effectiveStatus).toBe("backlog")
      expect(flow.subtasks[0].statusView.isManuallyEditable).toBe(false)
      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: currentStepId,
          status: "in-progress",
        })
      ).rejects.toThrow("Set the parent flow to auto to start the flow")

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: flowId,
        status: "auto",
      })
      flow = await user.query(api.tasks.queries.listSubtasks, { id: flowId })
      expect(intentCommand(flow.parentStatusView.statusIntent)).toBe("auto")
      expect(flow.subtasks[0].statusView.effectiveStatus).toBe("to-do")
      expect(flow.subtasks[0].statusView.isManuallyEditable).toBe(true)
    })

    test("completed flows resolve through parent review and do not expose backlog", async () => {
      const t = convexTest(schema, modules)
      const { actorId, flowId, reviewerId } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "done",
        })
        return { actorId, flowId, reviewerId }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId: flowId,
        reviewer: { type: "users", id: reviewerId },
      })
      const view = await actor.query(api.tasks.queries.getStatusView, {
        id: flowId,
      })

      expect(view.effectiveStatus).toBe("awaiting-review")
      expect(view.flow?.currentStepId).toBe(null)
      expect(view.statusOptions).toEqual(["auto", "cancelled"])
      await expect(
        actor.mutation(api.tasks.mutations.setTaskStatus, {
          id: flowId,
          status: "backlog",
        })
      ).rejects.toThrow("Completed flows can only be auto-set or cancelled")
    })
  })

  describe("2. Phase Making Active", () => {
    test("setting the current phase activates standard task trees and lets flows manage their current step", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { phaseId, standardId, standardChildId, flowId, flowStepId } =
        await t.run(async (ctx) => {
          const phaseId = await insertPhase(ctx)
          const standardId = await insertTask(ctx, {
            parent: { type: "phases", id: phaseId },
            order: "a",
            status: "backlog",
          })
          const standardChildId = await insertTask(ctx, {
            parent: { type: "tasks", id: standardId },
            order: "a",
            status: "backlog",
          })
          const flowId = await insertTask(ctx, {
            parent: { type: "phases", id: phaseId },
            order: "b",
            kind: "flow",
            status: "backlog",
          })
          const flowStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "backlog",
          })
          await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "backlog",
          })
          return { phaseId, standardId, standardChildId, flowId, flowStepId }
        })

      await user.mutation(api.tasks.mutations.activatePhaseTasks, { phaseId })
      const statuses = await t.run(async (ctx) => {
        const standard = await ctx.db.get("tasks", standardId)
        const standardChild = await ctx.db.get("tasks", standardChildId)
        const flowStep = await ctx.db.get("tasks", flowStepId)
        if (!standard || !standardChild || !flowStep) {
          throw new Error("Missing task")
        }
        return {
          standard: standard.status,
          standardChild: standardChild.status,
          flowStep: flowStep.status,
        }
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })

      expect(statuses).toEqual({
        standard: "to-do",
        standardChild: "to-do",
        flowStep: "to-do",
      })
      expect(intentCommand(flow.parentStatusView.statusIntent)).toBe("auto")
      expect(flow.parentStatusView.flow?.currentStepId).toBe(flowStepId)
      expect(flow.subtasks[1].statusView.effectiveStatus).toBe("backlog")
    })
  })

  describe("3. Awaiting Review", () => {
    test("pending reviews allow awaiting-review and reject user-driven done", async () => {
      const t = convexTest(schema, modules)
      const { actorId, taskId, reviewerId } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const taskId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        return { actorId, taskId, reviewerId }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId,
        reviewer: { type: "users", id: reviewerId },
      })
      const pendingView = await actor.query(api.tasks.queries.getStatusView, {
        id: taskId,
      })
      expect(pendingView.statusOptions).toContain("awaiting-review")
      expect(pendingView.statusOptions).not.toContain("done")
      await expect(
        actor.mutation(api.tasks.mutations.setTaskStatus, {
          id: taskId,
          status: "done",
        })
      ).rejects.toThrow("Tasks with pending reviews cannot be marked done")

      await actor.mutation(api.tasks.mutations.setTaskStatus, {
        id: taskId,
        status: "awaiting-review",
      })
      await actor.mutation(api.tasks.reviews.mutations.approveReviewer, {
        taskId,
        reviewer: { type: "users", id: reviewerId },
      })
      const approvedView = await actor.query(api.tasks.queries.getStatusView, {
        id: taskId,
      })
      expect(intentCommand(approvedView.statusIntent)).toBe("awaiting-review")
      expect(approvedView.effectiveStatus).toBe("done")
    })

    test("review changes reopen completed past flow steps as awaiting review but not cancelled steps", async () => {
      const t = convexTest(schema, modules)
      const {
        actorId,
        reopenedFlowId,
        completedStepId,
        cancelledFlowId,
        cancelledStepId,
        cancelledCurrentStepId,
        reviewerId,
      } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const reopenedFlowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "in-progress",
        })
        const completedStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: reopenedFlowId },
          order: "a",
          status: "done",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: reopenedFlowId },
          order: "b",
          status: "in-progress",
        })
        const cancelledFlowId = await seedPhaseTask(ctx, {
          order: "b",
          kind: "flow",
          status: "in-progress",
        })
        const cancelledStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: cancelledFlowId },
          order: "a",
          status: "cancelled",
        })
        const cancelledCurrentStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: cancelledFlowId },
          order: "b",
          status: "in-progress",
        })
        for (const taskId of [completedStepId, cancelledStepId]) {
          await ctx.db.insert("taskReviewers", {
            taskId,
            reviewer: { type: "users", id: reviewerId },
            approvedAt: Date.now(),
            approvedBy: actorId,
          })
        }
        return {
          actorId,
          reopenedFlowId,
          completedStepId,
          cancelledFlowId,
          cancelledStepId,
          cancelledCurrentStepId,
          reviewerId,
        }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.revokeReviewerApproval, {
        taskId: completedStepId,
        reviewer: { type: "users", id: reviewerId },
      })
      let flow = await actor.query(api.tasks.queries.listSubtasks, {
        id: reopenedFlowId,
      })
      expect(flow.parentStatusView.flow?.currentStepId).toBe(completedStepId)
      expect(flow.parentStatusView.effectiveStatus).toBe("awaiting-review")
      expect(flow.subtasks[0].statusView.effectiveStatus).toBe(
        "awaiting-review"
      )

      await actor.mutation(api.tasks.reviews.mutations.revokeReviewerApproval, {
        taskId: cancelledStepId,
        reviewer: { type: "users", id: reviewerId },
      })
      flow = await actor.query(api.tasks.queries.listSubtasks, {
        id: cancelledFlowId,
      })
      expect(flow.parentStatusView.flow?.currentStepId).toBe(
        cancelledCurrentStepId
      )
      expect(flow.subtasks[0].statusView.effectiveStatus).toBe("cancelled")
    })
  })

  describe("4. Incomplete Subtasks", () => {
    test("standard tasks with incomplete subtasks cannot be done or awaiting-review but can be cancelled", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const parentId = await t.run(async (ctx) => {
        const parentId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "to-do",
        })
        return parentId
      })

      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: parentId,
          status: "done",
        })
      ).rejects.toThrow(
        "Tasks with incomplete subtasks cannot be marked done or awaiting review"
      )
      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: parentId,
          status: "awaiting-review",
        })
      ).rejects.toThrow(
        "Tasks with incomplete subtasks cannot be marked done or awaiting review"
      )

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: parentId,
        status: "cancelled",
      })
      const view = await user.query(api.tasks.queries.getStatusView, {
        id: parentId,
      })
      expect(view.effectiveStatus).toBe("cancelled")
    })

    test("uncompleting a subtask of a completed standard flow step reopens that step and backlogs later work", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, aggregateStepId, childId, laterStepId } = await t.run(
        async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "in-progress",
          })
          const aggregateStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "done",
          })
          const childId = await insertTask(ctx, {
            parent: { type: "tasks", id: aggregateStepId },
            order: "a",
            status: "done",
          })
          const laterStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "in-progress",
          })
          return { flowId, aggregateStepId, childId, laterStepId }
        }
      )

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: childId,
        status: "to-do",
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })

      expect(flow.parentStatusView.flow?.currentStepId).toBe(aggregateStepId)
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: aggregateStepId, status: "in-progress" },
        { id: laterStepId, status: "backlog" },
      ])
    })
  })

  describe("5. Manual changes", () => {
    test("manual options reflect flow and subtask limits before mutations run", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, currentStepId, futureStepId } = await t.run(
        async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          const currentStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "to-do",
          })
          const futureStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "backlog",
          })
          return { flowId, currentStepId, futureStepId }
        }
      )

      const parent = await user.query(api.tasks.queries.getStatusView, {
        id: flowId,
      })
      const current = await user.query(api.tasks.queries.getStatusView, {
        id: currentStepId,
      })
      const future = await user.query(api.tasks.queries.getStatusView, {
        id: futureStepId,
      })

      expect(parent.statusOptions).toEqual(["backlog", "auto", "cancelled"])
      expect(current.statusOptions).not.toContain("backlog")
      expect(future).toMatchObject({
        effectiveStatus: "backlog",
        isManuallyEditable: false,
        statusOptions: [],
      })
      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: futureStepId,
          status: "done",
        })
      ).rejects.toThrow("Only the current flow step can be edited")
    })

    test("status-change preview reports side-effect flow step reopens before manual changes", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, aggregateStepId, childId } = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "in-progress",
        })
        const aggregateStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "done",
        })
        const childId = await insertTask(ctx, {
          parent: { type: "tasks", id: aggregateStepId },
          order: "a",
          status: "done",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "in-progress",
        })
        return { flowId, aggregateStepId, childId }
      })

      const preview = await user.query(
        api.tasks.queries.previewFlowReopenForStatusChange,
        {
          id: childId,
          status: "to-do",
        }
      )

      expect(preview).toEqual({
        willReopenFlowStep: true,
        taskId: childId,
        flowId,
        reopenedStepId: aggregateStepId,
      })
    })
  })
})

describe("Regression coverage", () => {
  describe("1. Flows + backlog regressions", () => {
    test("empty flows are converted back to standard tasks during recompute", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const flowId = await t.run(async (ctx) =>
        seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
      )

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: flowId,
        status: "auto",
      })
      const task = await t.run(async (ctx) => {
        const task = await ctx.db.get("tasks", flowId)
        if (!task) throw new Error("Missing task")
        return task
      })
      const view = await user.query(api.tasks.queries.getStatusView, {
        id: flowId,
      })

      expect(task.kind).toBe("standard")
      expect(view.kind).toBe("standard")
      expect(view.effectiveStatus).toBe("to-do")
    })

    test("converting an empty standard task to a flow reverts it to a standard task", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const taskId = await t.run(async (ctx) =>
        seedPhaseTask(ctx, {
          order: "a",
          status: "in-progress",
        })
      )

      await user.mutation(api.tasks.mutations.setTaskKind, {
        id: taskId,
        kind: "flow",
      })
      const view = await user.query(api.tasks.queries.getStatusView, {
        id: taskId,
      })

      expect(view.kind).toBe("standard")
      expect(view.effectiveStatus).toBe("in-progress")
    })

    test("converting an active standard task to a flow applies flow computation", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { taskId, currentStepId, futureStepId } = await t.run(
        async (ctx) => {
          const taskId = await seedPhaseTask(ctx, {
            order: "a",
            status: "in-progress",
          })
          await insertTask(ctx, {
            parent: { type: "tasks", id: taskId },
            order: "a",
            status: "done",
          })
          const currentStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: taskId },
            order: "b",
            status: "in-progress",
          })
          const futureStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: taskId },
            order: "c",
            status: "in-progress",
          })
          return { taskId, currentStepId, futureStepId }
        }
      )

      await user.mutation(api.tasks.mutations.setTaskKind, {
        id: taskId,
        kind: "flow",
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: taskId,
      })
      const futureStep = await user.query(api.tasks.queries.getStatusView, {
        id: futureStepId,
      })

      expect(intentCommand(flow.parentStatusView.statusIntent)).toBe("auto")
      expect(flow.parentStatusView.flow?.currentStepId).toBe(currentStepId)
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        {
          id: flow.subtasks[0].task._id,
          status: "done",
        },
        { id: currentStepId, status: "in-progress" },
        { id: futureStepId, status: "backlog" },
      ])
      expect(futureStep.effectiveStatus).toBe("backlog")
    })

    test("converting a backlog standard task to a flow keeps the flow paused", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { taskId, currentStepId, futureStepId } = await t.run(
        async (ctx) => {
          const taskId = await seedPhaseTask(ctx, {
            order: "a",
            status: "backlog",
          })
          await insertTask(ctx, {
            parent: { type: "tasks", id: taskId },
            order: "a",
            status: "done",
          })
          const currentStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: taskId },
            order: "b",
            status: "to-do",
          })
          const futureStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: taskId },
            order: "c",
            status: "in-progress",
          })
          return { taskId, currentStepId, futureStepId }
        }
      )

      await user.mutation(api.tasks.mutations.setTaskKind, {
        id: taskId,
        kind: "flow",
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: taskId,
      })

      expect(intentCommand(flow.parentStatusView.statusIntent)).toBe("backlog")
      expect(flow.parentStatusView.effectiveStatus).toBe("backlog")
      expect(flow.parentStatusView.flow?.currentStepId).toBe(currentStepId)
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
          editable: statusView.isManuallyEditable,
        }))
      ).toEqual([
        {
          id: flow.subtasks[0].task._id,
          status: "done",
          editable: false,
        },
        {
          id: currentStepId,
          status: "backlog",
          editable: false,
        },
        {
          id: futureStepId,
          status: "backlog",
          editable: false,
        },
      ])
    })

    test("active flow parents expose auto controls while displaying computed status", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const flowId = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "in-progress",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "backlog",
        })
        return flowId
      })

      const view = await user.query(api.tasks.queries.getStatusView, {
        id: flowId,
      })

      expect(view.effectiveStatus).toBe("in-progress")
      expect(view.statusOptions).toEqual(["backlog", "auto", "cancelled"])
    })

    test("derives the parent status from the earliest incomplete step", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const flowId = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          name: "Flow",
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "done",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "in-progress",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "c",
          status: "to-do",
        })
        return flowId
      })

      const result = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })

      expect(result.parentStatusView.effectiveStatus).toBe("in-progress")
      expect(result.parentStatusView.flow).toMatchObject({
        currentStepIndex: 1,
        totalSteps: 3,
      })
      expect(
        result.subtasks.map(({ statusView }) => ({
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { status: "done" },
        { status: "in-progress" },
        { status: "backlog" },
      ])
    })

    test("completing the current flow step activates the next step", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, firstStepId, secondStepId, thirdStepId } = await t.run(
        async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          const firstStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "to-do",
          })
          const secondStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "backlog",
          })
          const thirdStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "c",
            status: "backlog",
          })
          return { flowId, firstStepId, secondStepId, thirdStepId }
        }
      )

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: firstStepId,
        status: "done",
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })

      expect(flow.parentStatusView.flow?.currentStepId).toBe(secondStepId)
      expect(flow.parentStatusView.effectiveStatus).toBe("to-do")
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: firstStepId, status: "done" },
        { id: secondStepId, status: "to-do" },
        { id: thirdStepId, status: "backlog" },
      ])
    })

    test("setting a flow parent to backlog pauses the current step until the parent is set to auto", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, currentStepId } = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        const currentStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "backlog",
        })
        return { flowId, currentStepId }
      })

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: flowId,
        status: "backlog",
      })
      let flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      expect(flow.parentStatusView.effectiveStatus).toBe("backlog")
      expect(flow.subtasks[0].statusView.effectiveStatus).toBe("backlog")
      expect(flow.subtasks[0].statusView.isManuallyEditable).toBe(false)

      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: currentStepId,
          status: "in-progress",
        })
      ).rejects.toThrow("Set the parent flow to auto to start the flow")
      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: flowId,
        status: "auto",
      })
      flow = await user.query(api.tasks.queries.listSubtasks, { id: flowId })
      expect(intentCommand(flow.parentStatusView.statusIntent)).toBe("auto")
      expect(flow.parentStatusView.effectiveStatus).toBe("to-do")
      expect(flow.parentStatusView.flow?.currentStepId).toBe(currentStepId)
      expect(flow.subtasks[0].statusView.isManuallyEditable).toBe(true)
    })

    test("cancelling a flow parent masks the parent without changing children", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, currentStepId, futureStepId } = await t.run(
        async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          const currentStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "in-progress",
          })
          const futureStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "backlog",
          })
          return { flowId, currentStepId, futureStepId }
        }
      )

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: flowId,
        status: "cancelled",
      })
      let flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      const cancelledChildren = await t.run(async (ctx) => {
        const currentStep = await ctx.db.get("tasks", currentStepId)
        const futureStep = await ctx.db.get("tasks", futureStepId)
        if (!currentStep || !futureStep) throw new Error("Missing step")
        return [currentStep.status, futureStep.status]
      })

      expect(flow.parentStatusView.effectiveStatus).toBe("cancelled")
      expect(flow.parentStatusView.statusOptions).toEqual([
        "backlog",
        "auto",
        "cancelled",
      ])
      expect(cancelledChildren).toEqual(["in-progress", "backlog"])

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: flowId,
        status: "auto",
      })
      flow = await user.query(api.tasks.queries.listSubtasks, { id: flowId })
      expect(flow.parentStatusView.effectiveStatus).toBe("in-progress")
    })

    test("resuming a flow parent recursively activates standard subtasks of the current step", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, currentStepId, childId, grandchildId } = await t.run(
        async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "backlog",
          })
          const currentStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "backlog",
          })
          const childId = await insertTask(ctx, {
            parent: { type: "tasks", id: currentStepId },
            order: "a",
            status: "backlog",
          })
          const grandchildId = await insertTask(ctx, {
            parent: { type: "tasks", id: childId },
            order: "a",
            status: "backlog",
          })
          return { flowId, currentStepId, childId, grandchildId }
        }
      )

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: flowId,
        status: "auto",
      })
      const statuses = await t.run(async (ctx) => {
        const currentStep = await ctx.db.get("tasks", currentStepId)
        const child = await ctx.db.get("tasks", childId)
        const grandchild = await ctx.db.get("tasks", grandchildId)
        if (!currentStep || !child || !grandchild) {
          throw new Error("Missing task")
        }
        return {
          currentStep: currentStep.status,
          child: child.status,
          childManual: intentCommand(child.statusIntent),
          grandchild: grandchild.status,
        }
      })

      expect(statuses).toEqual({
        currentStep: "to-do",
        child: "to-do",
        childManual: "to-do",
        grandchild: "to-do",
      })
    })

    test("completed flow steps are locked until reopened", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, completedStepId } = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        const completedStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "done",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "to-do",
        })
        return { flowId, completedStepId }
      })

      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: completedStepId,
          status: "in-progress",
        })
      ).rejects.toThrow("Use reopen")

      await user.mutation(api.tasks.mutations.reopenTask, {
        id: completedStepId,
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      expect(
        flow.subtasks.map(({ statusView }) => statusView.effectiveStatus)
      ).toEqual(["to-do", "backlog"])
      expect(flow.parentStatusView.flow?.currentStepId).toBe(completedStepId)
    })

    test("reopening a cancelled past flow step restarts it as to-do", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, cancelledStepId, laterStepId } = await t.run(
        async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "in-progress",
          })
          const cancelledStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "cancelled",
          })
          const laterStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "in-progress",
          })
          return { flowId, cancelledStepId, laterStepId }
        }
      )

      await user.mutation(api.tasks.mutations.reopenTask, {
        id: cancelledStepId,
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })

      expect(flow.parentStatusView.flow?.currentStepId).toBe(cancelledStepId)
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: cancelledStepId, status: "to-do" },
        { id: laterStepId, status: "backlog" },
      ])
    })

    test("reopening an earlier step backlogs later cancelled steps", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, firstStepId, secondStepId, cancelledFutureStepId } =
        await t.run(async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "in-progress",
          })
          const firstStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "done",
          })
          const secondStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "in-progress",
          })
          const cancelledFutureStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "c",
            status: "cancelled",
          })
          return { flowId, firstStepId, secondStepId, cancelledFutureStepId }
        })

      await user.mutation(api.tasks.mutations.reopenTask, {
        id: firstStepId,
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      const persisted = await t.run(async (ctx) => {
        const secondStep = await ctx.db.get("tasks", secondStepId)
        const cancelledFutureStep = await ctx.db.get(
          "tasks",
          cancelledFutureStepId
        )
        if (!secondStep || !cancelledFutureStep) throw new Error("Missing step")
        return {
          secondStep: secondStep.status,
          cancelledFutureStep: cancelledFutureStep.status,
          cancelledFutureIntent: intentCommand(
            cancelledFutureStep.statusIntent
          ),
        }
      })

      expect(flow.parentStatusView.flow?.currentStepId).toBe(firstStepId)
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: firstStepId, status: "to-do" },
        { id: secondStepId, status: "backlog" },
        { id: cancelledFutureStepId, status: "backlog" },
      ])
      expect(persisted).toEqual({
        secondStep: "backlog",
        cancelledFutureStep: "backlog",
        cancelledFutureIntent: "backlog",
      })
    })

    test("completed flow parents are not reopenable directly", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const flowId = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "done",
        })
        return flowId
      })

      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      expect(flow.parentStatusView.effectiveStatus).toBe("done")
      expect(flow.parentStatusView.availableActions).toEqual([])
      expect(flow.subtasks[0].statusView.availableActions).toEqual(["reopen"])
      await expect(
        user.mutation(api.tasks.mutations.reopenTask, { id: flowId })
      ).rejects.toThrow("Reopen a specific flow step")
    })

    test("completed flow parents cannot be moved back to backlog", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const flowId = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "done",
        })
        return flowId
      })

      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: flowId,
          status: "backlog",
        })
      ).rejects.toThrow("Completed flows can only be auto-set or cancelled")
    })

    test("cancelled flow steps count complete and advance the flow", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const flowId = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "cancelled",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "to-do",
        })
        return flowId
      })

      const view = await user.query(api.tasks.queries.getStatusView, {
        id: flowId,
      })
      expect(view.effectiveStatus).toBe("to-do")
      expect(view.progress).toMatchObject({
        total: 2,
        terminalComplete: 1,
        done: 0,
        cancelled: 1,
        incomplete: 1,
        percent: 50,
      })
      expect(view.flow?.currentStepIndex).toBe(1)
    })

    test("a flow with only cancelled steps completes through the parent review gate", async () => {
      const t = convexTest(schema, modules)
      const { actorId, flowId, reviewerId } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "cancelled",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "cancelled",
        })
        return { actorId, flowId, reviewerId }
      })
      const actor = t.withIdentity({ subject: actorId })

      let view = await actor.query(api.tasks.queries.getStatusView, {
        id: flowId,
      })
      expect(view.effectiveStatus).toBe("done")
      expect(view.flow?.currentStepId).toBe(null)
      expect(view.statusOptions).toEqual(["auto", "cancelled"])

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId: flowId,
        reviewer: { type: "users", id: reviewerId },
      })
      view = await actor.query(api.tasks.queries.getStatusView, {
        id: flowId,
      })
      expect(view.effectiveStatus).toBe("awaiting-review")
      expect(view.statusOptions).toEqual(["auto", "cancelled"])
    })

    test("reordering flow steps recomputes current and future step status", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, futureStepId } = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "done",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "to-do",
        })
        const futureStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "c",
          status: "backlog",
        })
        return { flowId, futureStepId }
      })

      await user.mutation(api.tasks.mutations.setTaskOrder, {
        id: futureStepId,
        order: "0",
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })

      expect(flow.parentStatusView.flow?.currentStepId).toBe(futureStepId)
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: futureStepId, status: "to-do" },
        {
          id: flow.subtasks[1].task._id,
          status: "backlog",
        },
        {
          id: flow.subtasks[2].task._id,
          status: "backlog",
        },
      ])
    })

    test("future flow steps are forced to backlog even if they were already terminal", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, staleFutureStepId } = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "to-do",
        })
        const staleFutureStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "done",
        })
        return { flowId, staleFutureStepId }
      })

      await user.mutation(api.tasks.mutations.setTaskOrder, {
        id: staleFutureStepId,
        order: "b",
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      const staleFutureStep = await t.run(async (ctx) => {
        const task = await ctx.db.get("tasks", staleFutureStepId)
        if (!task) throw new Error("Missing stale future step")
        return {
          status: task.status,
          statusIntent: intentCommand(task.statusIntent),
        }
      })

      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
          editable: statusView.isManuallyEditable,
        }))
      ).toEqual([
        {
          id: flow.subtasks[0].task._id,
          status: "to-do",
          editable: true,
        },
        {
          id: staleFutureStepId,
          status: "backlog",
          editable: false,
        },
      ])
      expect(staleFutureStep).toEqual({
        status: "backlog",
        statusIntent: "backlog",
      })
    })

    test("a nested flow can be the current step of an outer flow and advance it when completed", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { outerFlowId, nestedFlowId, nestedFinalStepId, outerNextStepId } =
        await t.run(async (ctx) => {
          const outerFlowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          const nestedFlowId = await insertTask(ctx, {
            parent: { type: "tasks", id: outerFlowId },
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          await insertTask(ctx, {
            parent: { type: "tasks", id: nestedFlowId },
            order: "a",
            status: "done",
          })
          const nestedFinalStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: nestedFlowId },
            order: "b",
            status: "to-do",
          })
          const outerNextStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: outerFlowId },
            order: "b",
            status: "backlog",
          })
          return {
            outerFlowId,
            nestedFlowId,
            nestedFinalStepId,
            outerNextStepId,
          }
        })

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: nestedFinalStepId,
        status: "done",
      })
      const outerFlow = await user.query(api.tasks.queries.listSubtasks, {
        id: outerFlowId,
      })
      const nestedFlow = await user.query(api.tasks.queries.listSubtasks, {
        id: nestedFlowId,
      })

      expect(nestedFlow.parentStatusView.effectiveStatus).toBe("done")
      expect(outerFlow.parentStatusView.effectiveStatus).toBe("to-do")
      expect(outerFlow.parentStatusView.flow?.currentStepId).toBe(
        outerNextStepId
      )
      expect(
        outerFlow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: nestedFlowId, status: "done" },
        { id: outerNextStepId, status: "to-do" },
      ])
    })

    test("pausing and resuming an outer flow through the parent controls a nested flow current step", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { outerFlowId, nestedFlowId, nestedCurrentStepId } = await t.run(
        async (ctx) => {
          const outerFlowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          const nestedFlowId = await insertTask(ctx, {
            parent: { type: "tasks", id: outerFlowId },
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          const nestedCurrentStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: nestedFlowId },
            order: "a",
            status: "to-do",
          })
          await insertTask(ctx, {
            parent: { type: "tasks", id: outerFlowId },
            order: "b",
            status: "backlog",
          })
          return { outerFlowId, nestedFlowId, nestedCurrentStepId }
        }
      )

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: outerFlowId,
        status: "backlog",
      })
      let nestedFlow = await user.query(api.tasks.queries.listSubtasks, {
        id: nestedFlowId,
      })
      expect(nestedFlow.parentStatusView.effectiveStatus).toBe("backlog")
      expect(nestedFlow.subtasks[0].statusView.effectiveStatus).toBe("backlog")
      expect(nestedFlow.subtasks[0].statusView.isManuallyEditable).toBe(false)

      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: nestedCurrentStepId,
          status: "in-progress",
        })
      ).rejects.toThrow("Set the parent flow to auto to start the flow")
      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: outerFlowId,
        status: "auto",
      })
      const outerFlow = await user.query(api.tasks.queries.listSubtasks, {
        id: outerFlowId,
      })
      nestedFlow = await user.query(api.tasks.queries.listSubtasks, {
        id: nestedFlowId,
      })
      expect(outerFlow.parentStatusView.effectiveStatus).toBe("to-do")
      expect(nestedFlow.parentStatusView.effectiveStatus).toBe("to-do")
      expect(nestedFlow.subtasks[0].statusView.effectiveStatus).toBe("to-do")
    })

    test("a paused outer flow prevents directly resuming its nested flow step", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { outerFlowId, nestedFlowId } = await t.run(async (ctx) => {
        const outerFlowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        const nestedFlowId = await insertTask(ctx, {
          parent: { type: "tasks", id: outerFlowId },
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: nestedFlowId },
          order: "a",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: outerFlowId },
          order: "b",
          status: "backlog",
        })
        return { outerFlowId, nestedFlowId }
      })

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: outerFlowId,
        status: "backlog",
      })
      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: nestedFlowId,
          status: "auto",
        })
      ).rejects.toThrow("Set the parent flow to auto to start the flow")
      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: outerFlowId,
        status: "auto",
      })
      const outerFlow = await user.query(api.tasks.queries.listSubtasks, {
        id: outerFlowId,
      })

      expect(outerFlow.parentStatusView.effectiveStatus).toBe("to-do")
      expect(outerFlow.subtasks[0].statusView.effectiveStatus).toBe("to-do")
    })

    test("normalizes a mixed nested flow with stale active future steps", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const {
        outerFlowId,
        nestedFlowId,
        nestedCurrentId,
        nestedFutureId,
        outerFutureId,
      } = await t.run(async (ctx) => {
        const outerFlowId = await seedPhaseTask(ctx, {
          name: "Outer flow",
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          name: "Already finished outer step",
          parent: { type: "tasks", id: outerFlowId },
          order: "a",
          status: "done",
        })
        const nestedFlowId = await insertTask(ctx, {
          name: "Nested flow step",
          parent: { type: "tasks", id: outerFlowId },
          order: "b",
          kind: "flow",
          status: "in-progress",
        })
        const outerFutureId = await insertTask(ctx, {
          name: "Incorrectly active outer future step",
          parent: { type: "tasks", id: outerFlowId },
          order: "c",
          status: "in-progress",
        })
        await insertTask(ctx, {
          name: "Nested finished step",
          parent: { type: "tasks", id: nestedFlowId },
          order: "a",
          status: "done",
        })
        const nestedCurrentId = await insertTask(ctx, {
          name: "Nested current step with subtasks",
          parent: { type: "tasks", id: nestedFlowId },
          order: "b",
          status: "in-progress",
        })
        const nestedFutureId = await insertTask(ctx, {
          name: "Incorrectly active nested future step",
          parent: { type: "tasks", id: nestedFlowId },
          order: "c",
          status: "in-progress",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: nestedCurrentId },
          order: "a",
          status: "done",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: nestedCurrentId },
          order: "b",
          status: "to-do",
        })

        return {
          outerFlowId,
          nestedFlowId,
          nestedCurrentId,
          nestedFutureId,
          outerFutureId,
        }
      })

      await user.mutation(api.tasks.mutations.setTaskOrder, {
        id: nestedFutureId,
        order: "c",
      })

      const outerFlow = await user.query(api.tasks.queries.listSubtasks, {
        id: outerFlowId,
      })
      const nestedFlow = await user.query(api.tasks.queries.listSubtasks, {
        id: nestedFlowId,
      })
      const nestedCurrent = await user.query(api.tasks.queries.getStatusView, {
        id: nestedCurrentId,
      })
      const persisted = await t.run(async (ctx) => {
        const nestedFuture = await ctx.db.get("tasks", nestedFutureId)
        const outerFuture = await ctx.db.get("tasks", outerFutureId)
        if (!nestedFuture || !outerFuture)
          throw new Error("Missing future step")
        return {
          nestedFuture: {
            status: nestedFuture.status,
            statusIntent: intentCommand(nestedFuture.statusIntent),
          },
          outerFuture: {
            status: outerFuture.status,
            statusIntent: intentCommand(outerFuture.statusIntent),
          },
        }
      })

      expect(outerFlow.parentStatusView.effectiveStatus).toBe("in-progress")
      expect(outerFlow.parentStatusView.flow?.currentStepId).toBe(nestedFlowId)
      expect(
        outerFlow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        {
          id: outerFlow.subtasks[0].task._id,
          status: "done",
        },
        { id: nestedFlowId, status: "in-progress" },
        { id: outerFutureId, status: "backlog" },
      ])
      expect(nestedFlow.parentStatusView.flow?.currentStepId).toBe(
        nestedCurrentId
      )
      expect(
        nestedFlow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        {
          id: nestedFlow.subtasks[0].task._id,
          status: "done",
        },
        { id: nestedCurrentId, status: "in-progress" },
        { id: nestedFutureId, status: "backlog" },
      ])
      expect(nestedCurrent.progress).toMatchObject({
        total: 2,
        terminalComplete: 1,
        incomplete: 1,
        percent: 50,
      })
      expect(persisted).toEqual({
        nestedFuture: {
          status: "backlog",
          statusIntent: "backlog",
        },
        outerFuture: {
          status: "backlog",
          statusIntent: "backlog",
        },
      })
    })

    test("completing the last deep child advances a flow through a standard aggregate step", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, aggregateStepId, finalChildId, nextStepId } = await t.run(
        async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          const aggregateStepId = await insertTask(ctx, {
            name: "Aggregate standard step",
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "in-progress",
          })
          await insertTask(ctx, {
            parent: { type: "tasks", id: aggregateStepId },
            order: "a",
            status: "done",
          })
          const finalChildId = await insertTask(ctx, {
            parent: { type: "tasks", id: aggregateStepId },
            order: "b",
            status: "to-do",
          })
          const nextStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "backlog",
          })
          return { flowId, aggregateStepId, finalChildId, nextStepId }
        }
      )

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: finalChildId,
        status: "done",
      })
      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: aggregateStepId,
        status: "done",
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      const aggregate = await user.query(api.tasks.queries.getStatusView, {
        id: aggregateStepId,
      })

      expect(aggregate.effectiveStatus).toBe("done")
      expect(flow.parentStatusView.flow?.currentStepId).toBe(nextStepId)
      expect(flow.parentStatusView.effectiveStatus).toBe("to-do")
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: aggregateStepId, status: "done" },
        { id: nextStepId, status: "to-do" },
      ])
    })

    test("reopening an early completed nested flow step backlogs later branches across levels", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { outerFlowId, nestedFlowId, nestedFirstStepId, outerNextStepId } =
        await t.run(async (ctx) => {
          const outerFlowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "to-do",
          })
          const nestedFlowId = await insertTask(ctx, {
            parent: { type: "tasks", id: outerFlowId },
            order: "a",
            kind: "flow",
            status: "done",
          })
          const nestedFirstStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: nestedFlowId },
            order: "a",
            status: "done",
          })
          await insertTask(ctx, {
            parent: { type: "tasks", id: nestedFlowId },
            order: "b",
            status: "done",
          })
          const outerNextStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: outerFlowId },
            order: "b",
            status: "in-progress",
          })
          return {
            outerFlowId,
            nestedFlowId,
            nestedFirstStepId,
            outerNextStepId,
          }
        })

      await user.mutation(api.tasks.mutations.reopenTask, {
        id: nestedFirstStepId,
      })
      const outerFlow = await user.query(api.tasks.queries.listSubtasks, {
        id: outerFlowId,
      })
      const nestedFlow = await user.query(api.tasks.queries.listSubtasks, {
        id: nestedFlowId,
      })
      const outerNextStep = await user.query(api.tasks.queries.getStatusView, {
        id: outerNextStepId,
      })

      expect(outerFlow.parentStatusView.flow?.currentStepId).toBe(nestedFlowId)
      expect(outerFlow.parentStatusView.effectiveStatus).toBe("to-do")
      expect(
        outerFlow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: nestedFlowId, status: "to-do" },
        { id: outerNextStepId, status: "backlog" },
      ])
      expect(
        nestedFlow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: nestedFirstStepId, status: "to-do" },
        {
          id: nestedFlow.subtasks[1].task._id,
          status: "backlog",
        },
      ])
      expect(outerNextStep.effectiveStatus).toBe("backlog")
      expect(outerNextStep.isManuallyEditable).toBe(false)
    })
  })

  describe("3. Awaiting Review regressions", () => {
    test("reports no reviews and therefore exposes done, not awaiting-review", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const taskId = await t.run(async (ctx) =>
        seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
      )

      const view = await user.query(api.tasks.queries.getStatusView, {
        id: taskId,
      })

      expect(view.review).toMatchObject({
        status: "not-required",
        hasReviews: false,
        hasPendingReviews: false,
        isApproved: false,
        isOverridden: false,
        override: null,
      })
      expect(view.statusOptions).toContain("done")
      expect(view.statusOptions).not.toContain("awaiting-review")
    })

    test("pending reviews expose awaiting-review instead of done", async () => {
      const t = convexTest(schema, modules)
      const { actorId, taskId, reviewerId } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const taskId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        return { actorId, taskId, reviewerId }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId,
        reviewer: { type: "users", id: reviewerId },
      })
      const view = await actor.query(api.tasks.queries.getStatusView, {
        id: taskId,
      })

      expect(view.review.status).toBe("pending")
      expect(view.statusOptions).toContain("awaiting-review")
      expect(view.statusOptions).not.toContain("done")
    })

    test("pending reviews reject done and allow awaiting-review", async () => {
      const t = convexTest(schema, modules)
      const { actorId, taskId, reviewerId } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const taskId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        return { actorId, taskId, reviewerId }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId,
        reviewer: { type: "users", id: reviewerId },
      })
      await expect(
        actor.mutation(api.tasks.mutations.setTaskStatus, {
          id: taskId,
          status: "done",
        })
      ).rejects.toThrow("Tasks with pending reviews cannot be marked done")
      await actor.mutation(api.tasks.mutations.setTaskStatus, {
        id: taskId,
        status: "awaiting-review",
      })
      const view = await actor.query(api.tasks.queries.getStatusView, {
        id: taskId,
      })

      expect(intentCommand(view.statusIntent)).toBe("awaiting-review")
      expect(view.effectiveStatus).toBe("awaiting-review")
    })

    test("approving the final reviewer recomputes awaiting-review to done", async () => {
      const t = convexTest(schema, modules)
      const { actorId, taskId, reviewerId } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const taskId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        return { actorId, taskId, reviewerId }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId,
        reviewer: { type: "users", id: reviewerId },
      })
      await actor.mutation(api.tasks.mutations.setTaskStatus, {
        id: taskId,
        status: "awaiting-review",
      })
      await actor.mutation(api.tasks.reviews.mutations.approveReviewer, {
        taskId,
        reviewer: { type: "users", id: reviewerId },
      })
      const view = await actor.query(api.tasks.queries.getStatusView, {
        id: taskId,
      })

      expect(intentCommand(view.statusIntent)).toBe("awaiting-review")
      expect(view.effectiveStatus).toBe("done")
    })

    test("adding a pending reviewer to a done task recomputes it to awaiting-review", async () => {
      const t = convexTest(schema, modules)
      const { actorId, taskId, reviewerId } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const taskId = await seedPhaseTask(ctx, {
          order: "a",
          status: "done",
        })
        return { actorId, taskId, reviewerId }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId,
        reviewer: { type: "users", id: reviewerId },
      })
      const view = await actor.query(api.tasks.queries.getStatusView, {
        id: taskId,
      })

      expect(intentCommand(view.statusIntent)).toBe("done")
      expect(view.effectiveStatus).toBe("awaiting-review")
    })

    test("removing the last pending reviewer recomputes awaiting-review to done and advances the flow", async () => {
      const t = convexTest(schema, modules)
      const { actorId, flowId, firstStepId, secondStepId, reviewerId } =
        await t.run(async (ctx) => {
          const actorId = await seedVolunteerTestUser(ctx, "Actor")
          const reviewerId = await insertUser(ctx, "Reviewer")
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "awaiting-review",
          })
          const firstStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "awaiting-review",
          })
          const secondStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "backlog",
          })
          await ctx.db.insert("taskReviewers", {
            taskId: firstStepId,
            reviewer: { type: "users", id: reviewerId },
            approvedAt: null,
            approvedBy: null,
          })
          return { actorId, flowId, firstStepId, secondStepId, reviewerId }
        })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.removeReviewer, {
        taskId: firstStepId,
        reviewer: { type: "users", id: reviewerId },
      })
      const flow = await actor.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })

      expect(flow.parentStatusView.flow?.currentStepId).toBe(secondStepId)
      expect(flow.parentStatusView.effectiveStatus).toBe("to-do")
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: firstStepId, status: "done" },
        { id: secondStepId, status: "to-do" },
      ])
    })

    test("approval override recomputes pending review status to done", async () => {
      const t = convexTest(schema, modules)
      const { actorId, taskId, reviewerId } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const taskId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        return { actorId, taskId, reviewerId }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId,
        reviewer: { type: "users", id: reviewerId },
      })
      await actor.mutation(api.tasks.mutations.setTaskStatus, {
        id: taskId,
        status: "awaiting-review",
      })
      await actor.mutation(api.tasks.reviews.mutations.overrideApproval, {
        taskId,
      })
      const view = await actor.query(api.tasks.queries.getStatusView, {
        id: taskId,
      })

      expect(view.review.isOverridden).toBe(true)
      expect(view.effectiveStatus).toBe("done")
    })

    test("revoking approval on a completed past flow step reopens it as awaiting review", async () => {
      const t = convexTest(schema, modules)
      const { actorId, flowId, firstStepId, secondStepId, reviewerId } =
        await t.run(async (ctx) => {
          const actorId = await seedVolunteerTestUser(ctx, "Actor")
          const reviewerId = await insertUser(ctx, "Reviewer")
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "in-progress",
          })
          const firstStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "done",
          })
          const secondStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "in-progress",
          })
          await ctx.db.insert("taskReviewers", {
            taskId: firstStepId,
            reviewer: { type: "users", id: reviewerId },
            approvedAt: Date.now(),
            approvedBy: actorId,
          })
          return { actorId, flowId, firstStepId, secondStepId, reviewerId }
        })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.revokeReviewerApproval, {
        taskId: firstStepId,
        reviewer: { type: "users", id: reviewerId },
      })
      const flow = await actor.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      const secondStep = await t.run(async (ctx) => {
        const task = await ctx.db.get("tasks", secondStepId)
        if (!task) throw new Error("Missing second step")
        return task
      })

      expect(flow.parentStatusView.flow?.currentStepId).toBe(firstStepId)
      expect(flow.parentStatusView.effectiveStatus).toBe("awaiting-review")
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        {
          id: firstStepId,
          status: "awaiting-review",
        },
        { id: secondStepId, status: "backlog" },
      ])
      expect(secondStep.status).toBe("backlog")
      expect(intentCommand(secondStep.statusIntent)).toBe("backlog")
    })

    test("review changes do not reopen cancelled past flow steps", async () => {
      const t = convexTest(schema, modules)
      const { actorId, flowId, firstStepId, secondStepId, reviewerId } =
        await t.run(async (ctx) => {
          const actorId = await seedVolunteerTestUser(ctx, "Actor")
          const reviewerId = await insertUser(ctx, "Reviewer")
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "in-progress",
          })
          const firstStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "cancelled",
          })
          const secondStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "in-progress",
          })
          await ctx.db.insert("taskReviewers", {
            taskId: firstStepId,
            reviewer: { type: "users", id: reviewerId },
            approvedAt: Date.now(),
            approvedBy: actorId,
          })
          return { actorId, flowId, firstStepId, secondStepId, reviewerId }
        })
      const actor = t.withIdentity({ subject: actorId })

      const preview = await actor.query(
        api.tasks.reviews.queries.previewFlowReopenForReviewChange,
        {
          taskId: firstStepId,
          operation: {
            type: "revoke-reviewer-approval",
            reviewer: { type: "users", id: reviewerId },
          },
        }
      )
      await actor.mutation(api.tasks.reviews.mutations.revokeReviewerApproval, {
        taskId: firstStepId,
        reviewer: { type: "users", id: reviewerId },
      })
      const flow = await actor.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })

      expect(preview.willReopenFlowStep).toBe(false)
      expect(flow.parentStatusView.flow?.currentStepId).toBe(secondStepId)
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: firstStepId, status: "cancelled" },
        { id: secondStepId, status: "in-progress" },
      ])
    })

    test("review-change preview reports when a past flow step would reopen", async () => {
      const t = convexTest(schema, modules)
      const {
        actorId,
        flowId,
        firstStepId,
        secondStepId,
        reviewerId,
        newReviewerId,
      } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const newReviewerId = await insertUser(ctx, "New Reviewer")
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "in-progress",
        })
        const firstStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "done",
        })
        const secondStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "to-do",
        })
        await ctx.db.insert("taskReviewers", {
          taskId: firstStepId,
          reviewer: { type: "users", id: reviewerId },
          approvedAt: Date.now(),
          approvedBy: actorId,
        })
        return {
          actorId,
          flowId,
          firstStepId,
          secondStepId,
          reviewerId,
          newReviewerId,
        }
      })
      const actor = t.withIdentity({ subject: actorId })

      const revokeApprovalPreview = await actor.query(
        api.tasks.reviews.queries.previewFlowReopenForReviewChange,
        {
          taskId: firstStepId,
          operation: {
            type: "revoke-reviewer-approval",
            reviewer: { type: "users", id: reviewerId },
          },
        }
      )
      const addPendingReviewerPreview = await actor.query(
        api.tasks.reviews.queries.previewFlowReopenForReviewChange,
        {
          taskId: firstStepId,
          operation: {
            type: "add-reviewer",
            reviewer: { type: "users", id: newReviewerId },
          },
        }
      )
      const removeReviewerPreview = await actor.query(
        api.tasks.reviews.queries.previewFlowReopenForReviewChange,
        {
          taskId: firstStepId,
          operation: {
            type: "remove-reviewer",
            reviewer: { type: "users", id: reviewerId },
          },
        }
      )
      const currentStepPreview = await actor.query(
        api.tasks.reviews.queries.previewFlowReopenForReviewChange,
        {
          taskId: secondStepId,
          operation: {
            type: "add-reviewer",
            reviewer: { type: "users", id: newReviewerId },
          },
        }
      )

      expect(revokeApprovalPreview).toEqual({
        willReopenFlowStep: true,
        taskId: firstStepId,
        flowId,
        reopenedStepId: firstStepId,
      })
      expect(addPendingReviewerPreview).toEqual({
        willReopenFlowStep: true,
        taskId: firstStepId,
        flowId,
        reopenedStepId: firstStepId,
      })
      expect(removeReviewerPreview).toEqual({
        willReopenFlowStep: false,
        taskId: firstStepId,
        flowId: null,
        reopenedStepId: null,
      })
      expect(currentStepPreview).toEqual({
        willReopenFlowStep: false,
        taskId: secondStepId,
        flowId: null,
        reopenedStepId: null,
      })
    })

    test("removing an approval override on a completed past flow step reopens it when reviews are pending", async () => {
      const t = convexTest(schema, modules)
      const { actorId, flowId, firstStepId, secondStepId } = await t.run(
        async (ctx) => {
          const actorId = await seedVolunteerTestUser(ctx, "Actor")
          const reviewerId = await insertUser(ctx, "Reviewer")
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "in-progress",
          })
          const firstStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "done",
          })
          const secondStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "in-progress",
          })
          await ctx.db.insert("taskReviewers", {
            taskId: firstStepId,
            reviewer: { type: "users", id: reviewerId },
            approvedAt: null,
            approvedBy: null,
          })
          await ctx.db.insert("taskReviewOverrides", {
            taskId: firstStepId,
            overriddenAt: Date.now(),
            overriddenBy: actorId,
          })
          return { actorId, flowId, firstStepId, secondStepId }
        }
      )
      const actor = t.withIdentity({ subject: actorId })

      const preview = await actor.query(
        api.tasks.reviews.queries.previewFlowReopenForReviewChange,
        {
          taskId: firstStepId,
          operation: { type: "remove-approval-override" },
        }
      )
      expect(preview).toEqual({
        willReopenFlowStep: true,
        taskId: firstStepId,
        flowId,
        reopenedStepId: firstStepId,
      })

      await actor.mutation(api.tasks.reviews.mutations.removeApprovalOverride, {
        taskId: firstStepId,
      })
      const flow = await actor.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })

      expect(flow.parentStatusView.flow?.currentStepId).toBe(firstStepId)
      expect(flow.parentStatusView.effectiveStatus).toBe("awaiting-review")
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        {
          id: firstStepId,
          status: "awaiting-review",
        },
        { id: secondStepId, status: "backlog" },
      ])
    })

    test("adding a pending review to a completed nested flow step reopens the outer flow", async () => {
      const t = convexTest(schema, modules)
      const {
        actorId,
        outerFlowId,
        nestedFlowId,
        outerNextStepId,
        reviewerId,
      } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const outerFlowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "in-progress",
        })
        const nestedFlowId = await insertTask(ctx, {
          parent: { type: "tasks", id: outerFlowId },
          order: "a",
          kind: "flow",
          status: "done",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: nestedFlowId },
          order: "a",
          status: "done",
        })
        const outerNextStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: outerFlowId },
          order: "b",
          status: "in-progress",
        })
        return {
          actorId,
          outerFlowId,
          nestedFlowId,
          outerNextStepId,
          reviewerId,
        }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId: nestedFlowId,
        reviewer: { type: "users", id: reviewerId },
      })
      const outerFlow = await actor.query(api.tasks.queries.listSubtasks, {
        id: outerFlowId,
      })
      const nestedFlow = await actor.query(api.tasks.queries.getStatusView, {
        id: nestedFlowId,
      })

      expect(nestedFlow.effectiveStatus).toBe("awaiting-review")
      expect(outerFlow.parentStatusView.flow?.currentStepId).toBe(nestedFlowId)
      expect(
        outerFlow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: nestedFlowId, status: "awaiting-review" },
        { id: outerNextStepId, status: "backlog" },
      ])
    })

    test("completed flow waits on reviews and then completes after approval", async () => {
      const t = convexTest(schema, modules)
      const { actorId, flowId, reviewerId } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "done",
        })
        return { actorId, flowId, reviewerId }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId: flowId,
        reviewer: { type: "users", id: reviewerId },
      })
      let view = await actor.query(api.tasks.queries.getStatusView, {
        id: flowId,
      })
      expect(view.effectiveStatus).toBe("awaiting-review")

      await actor.mutation(api.tasks.reviews.mutations.approveReviewer, {
        taskId: flowId,
        reviewer: { type: "users", id: reviewerId },
      })
      view = await actor.query(api.tasks.queries.getStatusView, {
        id: flowId,
      })
      expect(view.effectiveStatus).toBe("done")
    })
  })

  describe("4. Incomplete Subtasks regressions", () => {
    test("returns effective status, edit options, and subtask progress", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const parentId = await t.run(async (ctx) => {
        const parentId = await seedPhaseTask(ctx, {
          name: "Parent",
          order: "a",
          status: "in-progress",
        })
        await insertTask(ctx, {
          name: "Done child",
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "done",
        })
        await insertTask(ctx, {
          name: "Open child",
          parent: { type: "tasks", id: parentId },
          order: "b",
          status: "to-do",
        })
        return parentId
      })

      const view = await user.query(api.tasks.queries.getStatusView, {
        id: parentId,
      })

      expect(view.effectiveStatus).toBe("in-progress")
      expect(view.isManuallyEditable).toBe(true)
      expect(view.statusOptions).toEqual([
        "backlog",
        "to-do",
        "in-progress",
        "cancelled",
      ])
      expect(view.progress).toMatchObject({
        total: 2,
        terminalComplete: 1,
        done: 1,
        cancelled: 0,
        incomplete: 1,
        percent: 50,
      })
    })

    test("rejects done or awaiting-review commands while subtasks are incomplete", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const parentId = await t.run(async (ctx) => {
        const parentId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "to-do",
        })
        return parentId
      })

      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: parentId,
          status: "done",
        })
      ).rejects.toThrow(
        "Tasks with incomplete subtasks cannot be marked done or awaiting review"
      )
      let view = await user.query(api.tasks.queries.getStatusView, {
        id: parentId,
      })
      expect(intentCommand(view.statusIntent)).toBe("to-do")
      expect(view.effectiveStatus).toBe("to-do")
      expect(view.statusOptions).not.toContain("done")
      expect(view.statusOptions).not.toContain("awaiting-review")

      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: parentId,
          status: "awaiting-review",
        })
      ).rejects.toThrow(
        "Tasks with incomplete subtasks cannot be marked done or awaiting review"
      )
      view = await user.query(api.tasks.queries.getStatusView, { id: parentId })
      expect(intentCommand(view.statusIntent)).toBe("to-do")
      expect(view.effectiveStatus).toBe("to-do")

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: parentId,
        status: "cancelled",
      })
      view = await user.query(api.tasks.queries.getStatusView, { id: parentId })
      expect(intentCommand(view.statusIntent)).toBe("cancelled")
      expect(view.effectiveStatus).toBe("cancelled")
    })

    test("allows done once all subtasks are terminal-complete and counts cancelled as complete", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const parentId = await t.run(async (ctx) => {
        const parentId = await seedPhaseTask(ctx, {
          order: "a",
          status: "in-progress",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "done",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "b",
          status: "cancelled",
        })
        return parentId
      })

      const before = await user.query(api.tasks.queries.getStatusView, {
        id: parentId,
      })
      expect(before.statusOptions).toContain("done")
      expect(before.statusOptions).not.toContain("awaiting-review")
      expect(before.progress).toMatchObject({
        total: 2,
        terminalComplete: 2,
        done: 1,
        cancelled: 1,
        incomplete: 0,
        percent: 100,
      })

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: parentId,
        status: "done",
      })
      const after = await user.query(api.tasks.queries.getStatusView, {
        id: parentId,
      })
      expect(after.effectiveStatus).toBe("done")
    })

    test("standard tasks with only cancelled subtasks do not auto-complete", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const parentId = await t.run(async (ctx) => {
        const parentId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "cancelled",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "b",
          status: "cancelled",
        })
        return parentId
      })

      const view = await user.query(api.tasks.queries.getStatusView, {
        id: parentId,
      })

      expect(view.effectiveStatus).toBe("to-do")
      expect(view.statusOptions).toContain("done")
      expect(view.progress).toMatchObject({
        total: 2,
        terminalComplete: 2,
        cancelled: 2,
        incomplete: 0,
        percent: 100,
      })
    })

    test("uncompleting a child of a completed standard flow step reopens that step", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, aggregateStepId, childId, laterStepId } = await t.run(
        async (ctx) => {
          const flowId = await seedPhaseTask(ctx, {
            order: "a",
            kind: "flow",
            status: "in-progress",
          })
          const aggregateStepId = await insertTask(ctx, {
            name: "Completed aggregate step",
            parent: { type: "tasks", id: flowId },
            order: "a",
            status: "done",
          })
          const childId = await insertTask(ctx, {
            parent: { type: "tasks", id: aggregateStepId },
            order: "a",
            status: "done",
          })
          const laterStepId = await insertTask(ctx, {
            parent: { type: "tasks", id: flowId },
            order: "b",
            status: "in-progress",
          })
          return { flowId, aggregateStepId, childId, laterStepId }
        }
      )

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: childId,
        status: "to-do",
      })
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      const aggregate = await user.query(api.tasks.queries.getStatusView, {
        id: aggregateStepId,
      })
      const laterStep = await user.query(api.tasks.queries.getStatusView, {
        id: laterStepId,
      })

      expect(aggregate.effectiveStatus).toBe("in-progress")
      expect(flow.parentStatusView.flow?.currentStepId).toBe(aggregateStepId)
      expect(
        flow.subtasks.map(({ task, statusView }) => ({
          id: task._id,
          status: statusView.effectiveStatus,
        }))
      ).toEqual([
        { id: aggregateStepId, status: "in-progress" },
        { id: laterStepId, status: "backlog" },
      ])
      expect(laterStep.effectiveStatus).toBe("backlog")
      expect(laterStep.isManuallyEditable).toBe(false)
    })

    test("incomplete subtasks still force in-progress even with pending reviews", async () => {
      const t = convexTest(schema, modules)
      const { actorId, taskId, reviewerId } = await t.run(async (ctx) => {
        const actorId = await seedVolunteerTestUser(ctx, "Actor")
        const reviewerId = await insertUser(ctx, "Reviewer")
        const taskId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: taskId },
          order: "a",
          status: "to-do",
        })
        return { actorId, taskId, reviewerId }
      })
      const actor = t.withIdentity({ subject: actorId })

      await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
        taskId,
        reviewer: { type: "users", id: reviewerId },
      })
      await expect(
        actor.mutation(api.tasks.mutations.setTaskStatus, {
          id: taskId,
          status: "done",
        })
      ).rejects.toThrow("Tasks with incomplete subtasks cannot be marked done")
      const view = await actor.query(api.tasks.queries.getStatusView, {
        id: taskId,
      })

      expect(intentCommand(view.statusIntent)).toBe("to-do")
      expect(view.effectiveStatus).toBe("to-do")
    })
  })

  describe("5. Manual changes regressions", () => {
    test("status mutations return null for client-side command handling", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const taskId = await t.run(async (ctx) =>
        seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
      )

      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: taskId,
          status: "done",
        })
      ).resolves.toBeNull()
      await expect(
        user.mutation(api.tasks.mutations.reopenTask, { id: taskId })
      ).resolves.toBeNull()
    })

    test("moving a standard task to to-do moves direct backlog subtasks to to-do", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const parentId = await t.run(async (ctx) => {
        const parentId = await seedPhaseTask(ctx, {
          order: "a",
          status: "backlog",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "backlog",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "b",
          status: "backlog",
        })
        return parentId
      })

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: parentId,
        status: "to-do",
      })
      const result = await user.query(api.tasks.queries.listSubtasks, {
        id: parentId,
      })

      expect(result.parentStatusView.effectiveStatus).toBe("to-do")
      expect(
        result.subtasks.map(({ statusView }) => statusView.effectiveStatus)
      ).toEqual(["to-do", "to-do"])
    })

    test("moving a standard task to to-do recursively activates standard backlog subtasks", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { parentId, childId, grandchildId } = await t.run(async (ctx) => {
        const parentId = await seedPhaseTask(ctx, {
          order: "a",
          status: "backlog",
        })
        const childId = await insertTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "backlog",
        })
        const grandchildId = await insertTask(ctx, {
          parent: { type: "tasks", id: childId },
          order: "a",
          status: "backlog",
        })
        return { parentId, childId, grandchildId }
      })

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: parentId,
        status: "to-do",
      })
      const statuses = await t.run(async (ctx) => {
        const parent = await ctx.db.get("tasks", parentId)
        const child = await ctx.db.get("tasks", childId)
        const grandchild = await ctx.db.get("tasks", grandchildId)
        if (!parent || !child || !grandchild) throw new Error("Missing task")
        return {
          parent: parent.status,
          child: child.status,
          childManual: intentCommand(child.statusIntent),
          grandchild: grandchild.status,
          grandchildManual: intentCommand(grandchild.statusIntent),
        }
      })

      expect(statuses).toEqual({
        parent: "to-do",
        child: "to-do",
        childManual: "to-do",
        grandchild: "to-do",
        grandchildManual: "to-do",
      })
    })

    test("current flow step cannot be set to backlog", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, stepId } = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        const stepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "to-do",
        })
        return { flowId, stepId }
      })

      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: stepId,
          status: "backlog",
        })
      ).rejects.toThrow("Set the parent flow to backlog")
      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })
      expect(flow.subtasks[0].statusView.effectiveStatus).toBe("to-do")
      expect(flow.subtasks[0].statusView.statusOptions).not.toContain("backlog")
    })

    test("reopen action is rejected for active and future flow steps", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { currentStepId, staleFutureStepId } = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        const currentStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "to-do",
        })
        const staleFutureStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "done",
        })
        return { currentStepId, staleFutureStepId }
      })

      await expect(
        user.mutation(api.tasks.mutations.reopenTask, { id: currentStepId })
      ).rejects.toThrow("Only completed tasks can be reopened")
      await expect(
        user.mutation(api.tasks.mutations.reopenTask, { id: staleFutureStepId })
      ).rejects.toThrow("Only past completed flow steps can be reopened")
    })

    test("direct changes to future flow steps are rejected", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, staleFutureStepId } = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "to-do",
        })
        const staleFutureStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "done",
        })
        return { flowId, staleFutureStepId }
      })

      await expect(
        user.mutation(api.tasks.mutations.setTaskStatus, {
          id: staleFutureStepId,
          status: "done",
        })
      ).rejects.toThrow("Only the current flow step can be edited")

      const flow = await user.query(api.tasks.queries.listSubtasks, {
        id: flowId,
      })

      expect(flow.subtasks[1].statusView).toMatchObject({
        effectiveStatus: "backlog",
        isManuallyEditable: false,
        statusOptions: [],
      })
    })

    test("status-change preview reports side-effect flow step reopens", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const { flowId, aggregateStepId, childId } = await t.run(async (ctx) => {
        const flowId = await seedPhaseTask(ctx, {
          order: "a",
          kind: "flow",
          status: "in-progress",
        })
        const aggregateStepId = await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "done",
        })
        const childId = await insertTask(ctx, {
          parent: { type: "tasks", id: aggregateStepId },
          order: "a",
          status: "done",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "in-progress",
        })
        return { flowId, aggregateStepId, childId }
      })

      const reopenPreview = await user.query(
        api.tasks.queries.previewFlowReopenForStatusChange,
        {
          id: childId,
          status: "to-do",
        }
      )
      const terminalPreview = await user.query(
        api.tasks.queries.previewFlowReopenForStatusChange,
        {
          id: childId,
          status: "cancelled",
        }
      )

      expect(reopenPreview).toEqual({
        willReopenFlowStep: true,
        taskId: childId,
        flowId,
        reopenedStepId: aggregateStepId,
      })
      expect(terminalPreview).toEqual({
        willReopenFlowStep: false,
        taskId: childId,
        flowId: null,
        reopenedStepId: null,
      })
    })
  })

  describe("Operational limits and invariants", () => {
    test("moving a task with 200 direct backlog subtasks to to-do stays within recompute limits", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const parentId = await t.run(async (ctx) => {
        const parentId = await seedPhaseTask(ctx, {
          order: "a",
          status: "backlog",
        })
        for (let i = 0; i < 200; i += 1) {
          await insertTask(ctx, {
            parent: { type: "tasks", id: parentId },
            order: i.toString().padStart(3, "0"),
            status: "backlog",
          })
        }
        return parentId
      })

      await user.mutation(api.tasks.mutations.setTaskStatus, {
        id: parentId,
        status: "to-do",
      })
      const statuses = await t.run(async (ctx) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
            q.eq("parent.type", "tasks").eq("parent.id", parentId)
          )
          .take(201)
        return tasks.map((task) => task.status)
      })

      expect(statuses).toHaveLength(200)
      expect(statuses.every((status) => status === "to-do")).toBe(true)
    })

    test("status loader caches child and review reads within a view build", async () => {
      const t = convexTest(schema, modules)
      const stats = await t.run(async (ctx) => {
        const parentId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        await insertTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "to-do",
        })
        const parent = await ctx.db.get("tasks", parentId)
        if (!parent) throw new Error("Missing parent")

        const loader = new TaskStatusLoader(ctx)
        await buildTaskStatusView(loader, parent)
        await buildTaskStatusView(loader, parent)

        return loader.stats
      })

      expect(stats.childReads).toBe(1)
      expect(stats.reviewReads).toBe(1)
    })

    test("recompute fails loudly instead of looping through a parent cycle", async () => {
      const t = convexTest(schema, modules)
      const { client: user } = await withVolunteerTestClient(t)
      const secondId = await t.run(async (ctx) => {
        const firstId = await seedPhaseTask(ctx, {
          order: "a",
          status: "to-do",
        })
        const secondId = await insertTask(ctx, {
          parent: { type: "tasks", id: firstId },
          order: "a",
          status: "done",
        })
        await ctx.db.patch("tasks", firstId, {
          parent: { type: "tasks", id: secondId },
        })
        return secondId
      })

      await expect(
        user.mutation(api.tasks.mutations.setTaskOrder, {
          id: secondId,
          order: "b",
        })
      ).rejects.toThrow("Task status recompute parent cycle detected")
    })

    test("preview fails loudly instead of looping through a parent cycle", async () => {
      const t = convexTest(schema, modules)

      await expect(
        t.run(async (ctx) => {
          const firstId = await seedPhaseTask(ctx, {
            order: "a",
            status: "to-do",
          })
          const secondId = await insertTask(ctx, {
            parent: { type: "tasks", id: firstId },
            order: "a",
            status: "done",
          })
          await ctx.db.patch("tasks", firstId, {
            parent: { type: "tasks", id: secondId },
          })

          return await previewFlowReopenForTask(ctx, secondId)
        })
      ).rejects.toThrow("Task status preview parent cycle detected")
    })
  })
})
