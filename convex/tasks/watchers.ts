import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { concreteAssigneeIds } from "@/convex/tasks/assignees"

export const MAX_MANUAL_SUBSCRIBERS = 100

type ReadCtx = Pick<QueryCtx, "db">

export function taskWatcherIdsFromParts(
  task: Pick<Doc<"tasks">, "assigneeIds">,
  subscriberIds: Iterable<Id<"users">>
): Id<"users">[] {
  const watcherIds = new Set<Id<"users">>(concreteAssigneeIds(task.assigneeIds))
  for (const userId of subscriberIds) watcherIds.add(userId)
  return [...watcherIds]
}

export async function getTaskSubscriberIds(
  ctx: ReadCtx,
  taskId: Id<"tasks">
): Promise<Id<"users">[]> {
  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_object_type_and_object_id_and_userId", (q) =>
      q.eq("object.type", "tasks").eq("object.id", taskId)
    )
    .take(MAX_MANUAL_SUBSCRIBERS)
  return subscriptions.map((subscription) => subscription.userId)
}

export async function getTaskWatcherIds(
  ctx: ReadCtx,
  task: Doc<"tasks">
): Promise<Id<"users">[]> {
  return taskWatcherIdsFromParts(
    task,
    await getTaskSubscriberIds(ctx, task._id)
  )
}

export function buildTaskWatcherIdsByTaskId(
  tasks: Doc<"tasks">[],
  subscriptions: Doc<"subscriptions">[]
): Map<Id<"tasks">, Set<Id<"users">>> {
  const watcherIdsByTaskId = new Map<Id<"tasks">, Set<Id<"users">>>()

  for (const task of tasks) {
    watcherIdsByTaskId.set(
      task._id,
      new Set(concreteAssigneeIds(task.assigneeIds))
    )
  }

  for (const subscription of subscriptions) {
    if (subscription.object.type !== "tasks") continue
    const watchers =
      watcherIdsByTaskId.get(subscription.object.id) ?? new Set<Id<"users">>()
    watchers.add(subscription.userId)
    watcherIdsByTaskId.set(subscription.object.id, watchers)
  }

  return watcherIdsByTaskId
}

export function isTaskWatcher(
  watcherIdsByTaskId: Map<Id<"tasks">, Set<Id<"users">>>,
  taskId: Id<"tasks">,
  userId: Id<"users">
) {
  return watcherIdsByTaskId.get(taskId)?.has(userId) ?? false
}
