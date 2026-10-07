import { collectAll, type CompetitionOrProjectRef } from "@/convex/utils"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import type { Principal } from "@/convex/permissions/principal"
import { createTaskReadAccess } from "@/convex/tasks/access"
import { concreteAssigneeIds } from "@/convex/tasks/assignees"

/**
 * Every task under the given competitions and projects, one indexed read per
 * root. Each task records its `root`, so the root index alone is complete.
 */
export async function listTasksForRoots(
  ctx: QueryCtx,
  competitionIds: Id<"competitions">[],
  projectIds: Id<"projects">[]
): Promise<Doc<"tasks">[]> {
  const roots: CompetitionOrProjectRef[] = [
    ...competitionIds.map((id) => ({ type: "competitions", id }) as const),
    ...projectIds.map((id) => ({ type: "projects", id }) as const),
  ]
  const tasksByRoot = await Promise.all(
    roots.map((root) =>
      ctx.db
        .query("tasks")
        .withIndex("by_root_type_and_root_id", (q) =>
          q.eq("root.type", root.type).eq("root.id", root.id)
        )
        .collect()
    )
  )
  return tasksByRoot.flat()
}

export async function loadTaskBoardData(
  ctx: QueryCtx,
  principal: Principal,
  scope: { teamId?: Id<"teams">; assignedToMe?: boolean }
) {
  const [candidateTasks, taskReviewers, taskReviewOverrides, taskBlockers] =
    await Promise.all([
      scope.teamId === undefined
        ? collectAll(ctx, "tasks")
        : ctx.db
            .query("tasks")
            .withIndex("by_owner_type_and_owner_id", (q) =>
              q.eq("owner.type", "teams").eq("owner.id", scope.teamId)
            )
            .collect(),
      collectAll(ctx, "taskReviewers"),
      collectAll(ctx, "taskReviewOverrides"),
      collectAll(ctx, "taskBlockers"),
    ])
  const scopedTasks =
    scope.assignedToMe === true
      ? candidateTasks.filter((task) =>
          concreteAssigneeIds(task.assigneeIds).includes(principal.userId)
        )
      : candidateTasks
  const competitionIds = new Set(
    scopedTasks.flatMap((task) =>
      task.root.type === "competitions" ? [task.root.id] : []
    )
  )
  const projectIds = new Set(
    scopedTasks.flatMap((task) =>
      task.root.type === "projects" ? [task.root.id] : []
    )
  )
  const [competitionDocs, projectDocs] = await Promise.all([
    Promise.all(
      [...competitionIds].map((id) => ctx.db.get("competitions", id))
    ),
    Promise.all([...projectIds].map((id) => ctx.db.get("projects", id))),
  ])
  const competitions = competitionDocs.filter((doc) => doc !== null)
  const projects = projectDocs.filter((doc) => doc !== null)
  const access = await createTaskReadAccess(ctx, principal, {
    competitions,
    projects,
    taskReviewers,
  })
  const selectedTasks = scopedTasks.filter(access.canRead)
  const selectedTaskIds = new Set(selectedTasks.map((task) => task._id))
  // Authorization selects output rows, not status context. Private siblings may
  // contribute to flow state but do not gain read access through an assigned task.
  const selectedRootIds = new Set(selectedTasks.map((task) => task.root.id))
  const tasks =
    scope.teamId === undefined
      ? candidateTasks.filter((task) => selectedRootIds.has(task.root.id))
      : await listTasksForRoots(
          ctx,
          [
            ...new Set(
              selectedTasks.flatMap((task) =>
                task.root.type === "competitions" ? [task.root.id] : []
              )
            ),
          ],
          [
            ...new Set(
              selectedTasks.flatMap((task) =>
                task.root.type === "projects" ? [task.root.id] : []
              )
            ),
          ]
        )
  const phaseIds = new Set(tasks.map((task) => task.rootPhase.id))
  const phaseDocs = await Promise.all(
    [...phaseIds].map((id) => ctx.db.get("phases", id))
  )
  const phases = phaseDocs.filter((doc) => doc !== null)
  return {
    tasks,
    phases,
    competitions,
    projects,
    taskReviewers,
    taskReviewOverrides,
    taskBlockers,
    selectedTaskIds,
  }
}
