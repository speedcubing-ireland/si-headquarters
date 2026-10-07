import { collectAll } from "@/convex/utils"
import type { QueryCtx } from "@/convex/_generated/server"
import { canPerform, type Principal } from "@/convex/permissions/principal"
import {
  isCompetitionCancelled,
  isCompetitionComplete,
} from "@/convex/competitions/lifecycle"
import { listPhasesForOwnerBounded } from "@/convex/phases/model"
import { createTaskReadAccess } from "@/convex/tasks/access"
import { listTasksForRoots } from "@/convex/tasks/boardData"

/** Load complete status context, while keeping task and root visibility separate. */
export async function loadHomeTaskData(ctx: QueryCtx, principal: Principal) {
  const [
    allCompetitions,
    allProjects,
    taskReviewOverrides,
    taskReviewers,
    taskBlockers,
    subscriptions,
  ] = await Promise.all([
    collectAll(ctx, "competitions"),
    collectAll(ctx, "projects"),
    collectAll(ctx, "taskReviewOverrides"),
    collectAll(ctx, "taskReviewers"),
    collectAll(ctx, "taskBlockers"),
    ctx.db
      .query("subscriptions")
      .withIndex("by_userId_and_object_type_and_object_id", (q) =>
        q.eq("userId", principal.userId).eq("object.type", "tasks")
      )
      .collect(),
  ])
  const currentPhaseIds = new Set(
    allCompetitions.flatMap((competition) =>
      competition.phaseId === null ? [] : [competition.phaseId]
    )
  )
  const [access, currentPhases] = await Promise.all([
    createTaskReadAccess(ctx, principal, {
      competitions: allCompetitions,
      projects: allProjects,
      taskReviewers,
    }),
    Promise.all([...currentPhaseIds].map((id) => ctx.db.get("phases", id))),
  ])
  const currentPhaseById = new Map(
    currentPhases
      .filter((phase) => phase !== null)
      .map((phase) => [phase._id, phase])
  )
  const competitions = allCompetitions.filter(
    (competition) =>
      !isCompetitionCancelled(competition) &&
      !isCompetitionComplete(competition, currentPhaseById)
  )
  const liveCompetitionIds = new Set(
    competitions.map((competition) => competition._id)
  )
  const projectIds = new Set(allProjects.map((project) => project._id))
  // Assignees are stored in arrays without a membership index. Participants
  // need one scan to discover private tasks; managers can use live-root indexes.
  const candidateTasks = canPerform(principal, "manage", "Task")
    ? await listTasksForRoots(ctx, [...liveCompetitionIds], [...projectIds])
    : (await collectAll(ctx, "tasks")).filter((task) =>
        task.root.type === "competitions"
          ? liveCompetitionIds.has(task.root.id)
          : projectIds.has(task.root.id)
      )
  const selectedTasks = candidateTasks.filter(access.canRead)
  const selectedTaskIds = new Set(selectedTasks.map((task) => task._id))
  const selectedCompetitionIds = new Set(
    selectedTasks.flatMap((task) =>
      task.root.type === "competitions" ? [task.root.id] : []
    )
  )
  const selectedProjectIds = new Set(
    selectedTasks.flatMap((task) =>
      task.root.type === "projects" ? [task.root.id] : []
    )
  )
  const tasks = candidateTasks.filter((task) =>
    task.root.type === "competitions"
      ? selectedCompetitionIds.has(task.root.id)
      : selectedProjectIds.has(task.root.id)
  )
  const ownerPhases = await Promise.all([
    ...competitions
      .filter((competition) => selectedCompetitionIds.has(competition._id))
      .map((competition) =>
        listPhasesForOwnerBounded(ctx, {
          type: "competitions",
          id: competition._id,
        })
      ),
    ...allProjects
      .filter((project) => selectedProjectIds.has(project._id))
      .map((project) =>
        listPhasesForOwnerBounded(ctx, { type: "projects", id: project._id })
      ),
  ])
  const phases = ownerPhases.flat()
  const readableCompetitions = competitions.filter((competition) =>
    access.readableCompetitionIds.has(competition._id)
  )
  const readableProjects = allProjects.filter((project) =>
    access.readableProjectIds.has(project._id)
  )
  return {
    boardData: {
      selectedTaskIds,
      tasks,
      competitions,
      projects: allProjects,
      phases,
      taskReviewers,
      taskReviewOverrides,
      taskBlockers,
    },
    teamIds: access.teamIds,
    readableCompetitions,
    readableProjects,
    subscriptions,
  }
}
