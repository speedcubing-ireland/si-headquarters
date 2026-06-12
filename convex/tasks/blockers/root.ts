import type { Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import type { CompetitionOrProjectRef } from "@/convex/utils"

const MAX_ROOT_PHASES = 50
const MAX_PHASE_TASKS = 200

export async function listRootTaskIds(
  ctx: QueryCtx,
  root: CompetitionOrProjectRef
): Promise<Id<"tasks">[]> {
  const taskIds = new Set<Id<"tasks">>()
  const indexedTasks = await ctx.db
    .query("tasks")
    .withIndex("by_root_type_and_root_id_and_status", (q) =>
      q.eq("root.type", root.type).eq("root.id", root.id)
    )
    .collect()

  for (const task of indexedTasks) {
    taskIds.add(task._id)
  }

  const phases = await ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", root.type).eq("owner.id", root.id)
    )
    .order("asc")
    .take(MAX_ROOT_PHASES + 1)

  if (phases.length > MAX_ROOT_PHASES) {
    throw new Error(
      `Root object has more than ${String(MAX_ROOT_PHASES)} phases`
    )
  }

  for (const phase of phases) {
    const phaseTasks = await ctx.db
      .query("tasks")
      .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
        q.eq("parent.type", "phases").eq("parent.id", phase._id)
      )
      .order("asc")
      .take(MAX_PHASE_TASKS + 1)

    if (phaseTasks.length > MAX_PHASE_TASKS) {
      throw new Error(
        `Phase has more than ${String(MAX_PHASE_TASKS)} direct tasks`
      )
    }

    for (const phaseTask of phaseTasks) {
      taskIds.add(phaseTask._id)
      await collectDescendantTaskIds(ctx, phaseTask._id, taskIds, new Set())
    }
  }

  return [...taskIds]
}

async function collectDescendantTaskIds(
  ctx: QueryCtx,
  taskId: Id<"tasks">,
  taskIds: Set<Id<"tasks">>,
  visited: Set<Id<"tasks">>
) {
  if (visited.has(taskId)) {
    throw new Error("Task descendant cycle detected")
  }
  visited.add(taskId)

  const subtasks = await ctx.db
    .query("tasks")
    .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
      q.eq("parent.type", "tasks").eq("parent.id", taskId)
    )
    .order("asc")
    .take(MAX_PHASE_TASKS + 1)

  if (subtasks.length > MAX_PHASE_TASKS) {
    throw new Error(
      `Task has more than ${String(MAX_PHASE_TASKS)} direct subtasks`
    )
  }

  for (const subtask of subtasks) {
    taskIds.add(subtask._id)
    await collectDescendantTaskIds(ctx, subtask._id, taskIds, visited)
  }
}
