import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { scheduleCommentsDeletion } from "@/convex/comments/deletion"
import {
  reserveDeletionWork,
  type DeletionBudget,
} from "@/convex/deletion/budget"
import { cancelScheduledFunction } from "@/convex/deletion/scheduledFunctions"
import { runDeletionWork } from "@/convex/deletion/work"

export const MAX_TASK_DELETE_COUNT = 200
const MAX_ROWS_PER_TASK_RELATION = 500
const TASK_READ_CONCURRENCY = 2

interface TaskScopedRows {
  blockedEdges: Doc<"taskBlockers">[]
  blockingEdges: Doc<"taskBlockers">[]
  integrations: Doc<"taskIntegrations">[]
  labelAssignments: Doc<"taskLabelAssignments">[]
  nudgeCooldowns: Doc<"taskNudgeCooldowns">[]
  reminders: Doc<"taskReminders">[]
  reviewOverrides: Doc<"taskReviewOverrides">[]
  reviewers: Doc<"taskReviewers">[]
  subscriptions: Doc<"subscriptions">[]
}

export interface TaskDeletionPlan {
  blockerEdges: Doc<"taskBlockers">[]
  integrations: Doc<"taskIntegrations">[]
  labelAssignments: Doc<"taskLabelAssignments">[]
  nudgeCooldowns: Doc<"taskNudgeCooldowns">[]
  reminders: Doc<"taskReminders">[]
  reviewOverrides: Doc<"taskReviewOverrides">[]
  reviewers: Doc<"taskReviewers">[]
  subscriptions: Doc<"subscriptions">[]
  taskIds: Id<"tasks">[]
}

function emptyTaskDeletionPlan(taskIds: Id<"tasks">[]): TaskDeletionPlan {
  return {
    blockerEdges: [],
    integrations: [],
    labelAssignments: [],
    nudgeCooldowns: [],
    reminders: [],
    reviewOverrides: [],
    reviewers: [],
    subscriptions: [],
    taskIds,
  }
}

async function loadTaskScopedRows(
  ctx: MutationCtx,
  taskId: Id<"tasks">
): Promise<TaskScopedRows> {
  const take = MAX_ROWS_PER_TASK_RELATION + 1
  const [
    labelAssignments,
    reviewers,
    reviewOverrides,
    blockingEdges,
    blockedEdges,
    reminders,
    nudgeCooldowns,
    subscriptions,
    integrations,
  ] = await Promise.all([
    ctx.db
      .query("taskLabelAssignments")
      .withIndex("by_taskId_and_labelId", (q) => q.eq("taskId", taskId))
      .take(take),
    ctx.db
      .query("taskReviewers")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .take(take),
    ctx.db
      .query("taskReviewOverrides")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .take(take),
    ctx.db
      .query("taskBlockers")
      .withIndex("by_blockingTaskId_and_blockedTaskId", (q) =>
        q.eq("blockingTaskId", taskId)
      )
      .take(take),
    ctx.db
      .query("taskBlockers")
      .withIndex("by_blockedTaskId_and_blockingTaskId", (q) =>
        q.eq("blockedTaskId", taskId)
      )
      .take(take),
    ctx.db
      .query("taskReminders")
      .withIndex(
        "by_taskId_and_userId_and_cancelledAt_and_sentAt_and_remindAt",
        (q) => q.eq("taskId", taskId)
      )
      .take(take),
    ctx.db
      .query("taskNudgeCooldowns")
      .withIndex("by_taskId_and_assigneeId", (q) => q.eq("taskId", taskId))
      .take(take),
    ctx.db
      .query("subscriptions")
      .withIndex("by_object_type_and_object_id_and_userId", (q) =>
        q.eq("object.type", "tasks").eq("object.id", taskId)
      )
      .take(take),
    ctx.db
      .query("taskIntegrations")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .take(take),
  ])

  const relations = [
    labelAssignments,
    reviewers,
    reviewOverrides,
    blockingEdges,
    blockedEdges,
    reminders,
    nudgeCooldowns,
    subscriptions,
    integrations,
  ]
  if (relations.some((rows) => rows.length > MAX_ROWS_PER_TASK_RELATION)) {
    throw new Error(
      `Task has more than ${String(MAX_ROWS_PER_TASK_RELATION)} records in one related collection`
    )
  }

  return {
    blockedEdges,
    blockingEdges,
    integrations,
    labelAssignments,
    nudgeCooldowns,
    reminders,
    reviewOverrides,
    reviewers,
    subscriptions,
  }
}

export async function prepareTaskDeletion(
  ctx: MutationCtx,
  taskIds: Id<"tasks">[],
  budget: DeletionBudget
): Promise<TaskDeletionPlan> {
  const plan = emptyTaskDeletionPlan(taskIds)
  const blockerEdges = new Map<Id<"taskBlockers">, Doc<"taskBlockers">>()

  for (let index = 0; index < taskIds.length; index += TASK_READ_CONCURRENCY) {
    const batch = taskIds.slice(index, index + TASK_READ_CONCURRENCY)
    const rowsByTask = await Promise.all(
      batch.map(async (taskId) => await loadTaskScopedRows(ctx, taskId))
    )

    for (const rows of rowsByTask) {
      const blockerCountBefore = blockerEdges.size
      for (const edge of [...rows.blockingEdges, ...rows.blockedEdges]) {
        blockerEdges.set(edge._id, edge)
      }
      const newBlockerCount = blockerEdges.size - blockerCountBefore
      const scopedWriteCount =
        rows.labelAssignments.length +
        rows.reviewers.length +
        rows.reviewOverrides.length +
        newBlockerCount +
        rows.reminders.length +
        rows.nudgeCooldowns.length +
        rows.subscriptions.length +
        rows.integrations.length

      reserveDeletionWork(budget, {
        reason: "task-related records",
        scheduledFunctions: 1,
        writes: scopedWriteCount + 1,
      })
      plan.integrations.push(...rows.integrations)
      plan.labelAssignments.push(...rows.labelAssignments)
      plan.nudgeCooldowns.push(...rows.nudgeCooldowns)
      plan.reminders.push(...rows.reminders)
      plan.reviewOverrides.push(...rows.reviewOverrides)
      plan.reviewers.push(...rows.reviewers)
      plan.subscriptions.push(...rows.subscriptions)
    }
  }

  plan.blockerEdges = [...blockerEdges.values()]
  return plan
}

export async function executeTaskDeletion(
  ctx: MutationCtx,
  plan: TaskDeletionPlan
): Promise<void> {
  await runDeletionWork(plan.reminders, async (reminder) => {
    await cancelScheduledFunction(ctx, reminder.scheduledFunctionId)
  })
  await runDeletionWork(plan.taskIds, async (taskId) => {
    await scheduleCommentsDeletion(ctx, { type: "tasks", id: taskId })
  })

  await Promise.all([
    runDeletionWork(plan.labelAssignments, async (row) => {
      await ctx.db.delete("taskLabelAssignments", row._id)
    }),
    runDeletionWork(plan.reviewers, async (row) => {
      await ctx.db.delete("taskReviewers", row._id)
    }),
    runDeletionWork(plan.reviewOverrides, async (row) => {
      await ctx.db.delete("taskReviewOverrides", row._id)
    }),
    runDeletionWork(plan.blockerEdges, async (row) => {
      await ctx.db.delete("taskBlockers", row._id)
    }),
    runDeletionWork(plan.reminders, async (row) => {
      await ctx.db.delete("taskReminders", row._id)
    }),
    runDeletionWork(plan.nudgeCooldowns, async (row) => {
      await ctx.db.delete("taskNudgeCooldowns", row._id)
    }),
    runDeletionWork(plan.subscriptions, async (row) => {
      await ctx.db.delete("subscriptions", row._id)
    }),
    runDeletionWork(plan.integrations, async (row) => {
      await ctx.db.delete("taskIntegrations", row._id)
    }),
  ])
  await runDeletionWork(plan.taskIds, async (taskId) => {
    await ctx.db.delete("tasks", taskId)
  })
}

export async function collectTaskTreeForDeletion(
  ctx: MutationCtx,
  rootTaskId: Id<"tasks">
): Promise<Id<"tasks">[]> {
  const orderedTaskIds: Id<"tasks">[] = []
  const stack = [rootTaskId]
  const visited = new Set<Id<"tasks">>()

  while (stack.length > 0) {
    const taskId = stack.pop()
    if (taskId === undefined || visited.has(taskId)) continue
    visited.add(taskId)
    orderedTaskIds.push(taskId)

    if (orderedTaskIds.length > MAX_TASK_DELETE_COUNT) {
      throw new Error(
        `Task delete would remove more than ${String(MAX_TASK_DELETE_COUNT)} tasks`
      )
    }

    const children = await ctx.db
      .query("tasks")
      .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
        q.eq("parent.type", "tasks").eq("parent.id", taskId)
      )
      .take(MAX_TASK_DELETE_COUNT + 1)
    if (children.length > MAX_TASK_DELETE_COUNT) {
      throw new Error(
        `Task has more than ${String(MAX_TASK_DELETE_COUNT)} direct subtasks`
      )
    }
    for (const child of children) stack.push(child._id)
  }

  return orderedTaskIds.reverse()
}
