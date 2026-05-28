import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"

const MAX_COMPETITION_PHASES = 50
const MAX_PHASE_TASKS = 200

export async function getCompetitionIdForTask(
  ctx: QueryCtx,
  task: Doc<"tasks">
): Promise<Id<"competitions"> | null> {
  const visited = new Set<Id<"tasks">>()
  let parent = task.parent

  while (parent.type === "tasks") {
    if (visited.has(parent.id)) {
      throw new Error("Task parent cycle detected")
    }
    visited.add(parent.id)

    const parentTask = await ctx.db.get("tasks", parent.id)
    if (!parentTask) return null
    parent = parentTask.parent
  }

  const phase = await ctx.db.get("phases", parent.id)
  return phase?.owner.id ?? null
}

export async function listCompetitionTaskIds(
  ctx: QueryCtx,
  competitionId: Id<"competitions">
): Promise<Id<"tasks">[]> {
  const phases = await ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", "competitions").eq("owner.id", competitionId)
    )
    .order("asc")
    .take(MAX_COMPETITION_PHASES + 1)

  if (phases.length > MAX_COMPETITION_PHASES) {
    throw new Error(
      `Competition has more than ${String(MAX_COMPETITION_PHASES)} phases`
    )
  }

  const taskIds: Id<"tasks">[] = []

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
      taskIds.push(phaseTask._id)
      await collectDescendantTaskIds(ctx, phaseTask._id, taskIds, new Set())
    }
  }

  return taskIds
}

async function collectDescendantTaskIds(
  ctx: QueryCtx,
  taskId: Id<"tasks">,
  taskIds: Id<"tasks">[],
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
    taskIds.push(subtask._id)
    await collectDescendantTaskIds(ctx, subtask._id, taskIds, visited)
  }
}
