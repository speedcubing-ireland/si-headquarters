import { internal } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import type { NotificationEvent } from "@/convex/notifications/validators"
import {
  normalizeTaskAssigneeIds,
  sameUserIdList,
  userAssigneeIdsFromField,
} from "@/convex/tasks/assignees"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import type { TaskStatusMutationResult } from "@/convex/tasks/status/recompute"

const MAX_BLOCKER_EDGES_TO_CHECK = 100
const MAX_DUE_NOTICE_STATES_PER_TASK = 20

export async function scheduleNotificationEvent(
  ctx: Pick<MutationCtx, "scheduler">,
  event: NotificationEvent
) {
  await ctx.scheduler.runAfter(
    0,
    internal.notifications.dispatch.dispatchEvent,
    {
      event,
    }
  )
}

async function taskHasOpenBlockers(
  ctx: MutationCtx,
  blockedTaskId: Id<"tasks">
) {
  const blockers = await ctx.db
    .query("taskBlockers")
    .withIndex("by_blockedTaskId_and_blockingTaskId", (q) =>
      q.eq("blockedTaskId", blockedTaskId)
    )
    .take(MAX_BLOCKER_EDGES_TO_CHECK)
  const blockingTasks = await Promise.all(
    blockers.map((blocker) => ctx.db.get("tasks", blocker.blockingTaskId))
  )
  return blockingTasks.some(
    (task) => task !== null && !isTerminalComplete(task.status)
  )
}

async function scheduleTasksUnblockedByCompletedTask(
  ctx: MutationCtx,
  blockingTaskId: Id<"tasks">,
  actorId: Id<"users"> | null
) {
  const blockedEdges = await ctx.db
    .query("taskBlockers")
    .withIndex("by_blockingTaskId_and_blockedTaskId", (q) =>
      q.eq("blockingTaskId", blockingTaskId)
    )
    .take(MAX_BLOCKER_EDGES_TO_CHECK)

  for (const edge of blockedEdges) {
    const blockedTask = await ctx.db.get("tasks", edge.blockedTaskId)
    if (blockedTask === null || isTerminalComplete(blockedTask.status)) {
      continue
    }
    if (await taskHasOpenBlockers(ctx, blockedTask._id)) {
      continue
    }
    await scheduleNotificationEvent(ctx, {
      kind: "taskUnblocked",
      taskId: blockedTask._id,
      actorId,
    })
  }
}

export async function scheduleTaskUnblockedIfReady(
  ctx: MutationCtx,
  blockedTaskId: Id<"tasks">,
  actorId: Id<"users"> | null
) {
  const blockedTask = await ctx.db.get("tasks", blockedTaskId)
  if (blockedTask === null || isTerminalComplete(blockedTask.status)) {
    return
  }
  if (await taskHasOpenBlockers(ctx, blockedTask._id)) {
    return
  }
  await scheduleNotificationEvent(ctx, {
    kind: "taskUnblocked",
    taskId: blockedTask._id,
    actorId,
  })
}

export async function assignTaskAndNotify(
  ctx: MutationCtx,
  input: {
    taskId: Id<"tasks">
    assigneeIds: Doc<"tasks">["assigneeIds"]
    actorId: Id<"users"> | null
  }
) {
  const task = await ctx.db.get("tasks", input.taskId)
  if (task === null) throw new Error("Task not found")

  const normalizedAssigneeIds = normalizeTaskAssigneeIds(input.assigneeIds)
  const previousAssigneeIds = userAssigneeIdsFromField(task.assigneeIds)
  const nextAssigneeIds = userAssigneeIdsFromField(normalizedAssigneeIds)
  const assigneesChanged =
    previousAssigneeIds !== null || nextAssigneeIds !== null
      ? !sameUserIdList(previousAssigneeIds, nextAssigneeIds)
      : task.assigneeIds !== normalizedAssigneeIds

  if (!assigneesChanged) return task

  await ctx.db.patch("tasks", task._id, {
    assigneeIds: normalizedAssigneeIds,
  })

  if (sameUserIdList(previousAssigneeIds, nextAssigneeIds)) {
    return task
  }

  await scheduleNotificationEvent(ctx, {
    kind: "taskAssigned",
    taskId: task._id,
    actorId: input.actorId,
    previousAssigneeIds,
    nextAssigneeIds,
  })

  return task
}

export async function scheduleTaskStatusNotifications(
  ctx: MutationCtx,
  result: TaskStatusMutationResult,
  actorId: Id<"users"> | null
) {
  for (const change of result.changedTasks) {
    if (change.before.status !== change.after.status) {
      await scheduleNotificationEvent(ctx, {
        kind: "taskStatusChanged",
        taskId: change.taskId,
        actorId,
        previousStatus: change.before.status,
        nextStatus: change.after.status,
      })
    }

    if (
      !isTerminalComplete(change.before.status) &&
      isTerminalComplete(change.after.status)
    ) {
      await scheduleTasksUnblockedByCompletedTask(ctx, change.taskId, actorId)
    }

    if (
      change.before.status !== "awaiting-review" &&
      change.after.status === "awaiting-review"
    ) {
      await scheduleNotificationEvent(ctx, {
        kind: "taskAwaitingReview",
        taskId: change.taskId,
        actorId,
      })
    }

    const task = await ctx.db.get("tasks", change.taskId)
    if (
      task?.assigneeIds === "assignable" &&
      change.before.status === "backlog" &&
      change.after.status !== "backlog"
    ) {
      await scheduleNotificationEvent(ctx, {
        kind: "assignableTaskReady",
        taskId: change.taskId,
        actorId,
      })
    }
  }
}

export async function resetTaskDueNoticeState(
  ctx: MutationCtx,
  taskId: Id<"tasks">
) {
  const states = await ctx.db
    .query("taskDueNoticeStates")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .take(MAX_DUE_NOTICE_STATES_PER_TASK)
  await Promise.all(
    states.map((state) => ctx.db.delete("taskDueNoticeStates", state._id))
  )
}
