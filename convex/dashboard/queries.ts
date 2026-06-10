import { collectAll, type CompetitionOrProjectRef } from "@/convex/utils"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { query } from "@/convex/_generated/server"
import { phaseSnapshot, phaseSnapshotValidator } from "@/convex/phases/progress"
import { dublinToday } from "@/convex/notifications/time"
import {
  canPerform,
  isCompetitionSteward,
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import { canReadProject, isProjectLead } from "@/convex/projects/access"
import { teamIdsForTeamNames } from "@/convex/teams/model"
import { buildTaskBoardRows, taskBoardRow } from "@/convex/tasks/board"
import {
  buildOwnerPhaseScanContext,
  currentPhaseIdForOwner,
  isTaskOverdue,
} from "@/convex/tasks/overdue"
import { pendingReviewTaskIdsForPrincipal } from "@/convex/tasks/reviews/reviewState"
import type { TaskStatusCommand } from "@/convex/tasks/status/rules"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import {
  buildTaskWatcherIdsByTaskId,
  isTaskWatcher,
} from "@/convex/tasks/watchers"
import { v, type Infer } from "convex/values"

const COMPETITION_LIMIT = 6
const PROJECT_LIMIT = 6
const STEWARD_OVERDUE_LIMIT = 20

type TaskBoardRow = Infer<typeof taskBoardRow>

function competitionPrimaryStart(
  compDates: Doc<"competitions">["compDates"]
): string | null {
  const from = compDates.from
  if (from !== null && from.length > 0) return from
  const to = compDates.to
  return to !== null && to.length > 0 ? to : null
}

const taskActionReasonValidator = v.union(
  v.literal("blocking"),
  v.literal("overdue"),
  v.literal("review"),
  v.literal("unassigned-owned"),
  v.literal("assigned-todo"),
  v.literal("in-progress"),
  v.literal("assigned-open")
)

const taskPrimaryActionValidator = v.union(
  v.literal("open-task"),
  v.literal("view"),
  v.literal("claim"),
  v.literal("start"),
  v.literal("complete")
)

const taskActionValidator = v.object({
  reason: taskActionReasonValidator,
  reasonLabel: v.string(),
  primaryAction: taskPrimaryActionValidator,
  explanation: v.string(),
  task: taskBoardRow,
})

type TaskActionReason = Infer<typeof taskActionReasonValidator>
type TaskPrimaryAction = Infer<typeof taskPrimaryActionValidator>
type TaskAction = Infer<typeof taskActionValidator>

const competitionWorkSummaryValidator = v.object({
  _id: v.id("competitions"),
  name: v.string(),
  compDates: v.object({
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  phase: phaseSnapshotValidator,
  activeTaskCount: v.number(),
  blockedTaskCount: v.number(),
  overdueTaskCount: v.number(),
})

const projectWorkSummaryValidator = v.object({
  _id: v.id("projects"),
  name: v.string(),
  phase: phaseSnapshotValidator,
  activeTaskCount: v.number(),
  blockedTaskCount: v.number(),
  overdueTaskCount: v.number(),
})

function isActiveTask(row: TaskBoardRow) {
  return !isTerminalComplete(row.statusView.effectiveStatus)
}

function isNonBacklogOpenTask(row: TaskBoardRow) {
  return isActiveTask(row) && row.statusView.effectiveStatus !== "backlog"
}

function isInOwnerCurrentPhase(
  row: TaskBoardRow,
  ownerId: Id<"competitions"> | Id<"projects">,
  ownerType: CompetitionOrProjectRef["type"],
  currentPhaseId: Id<"phases"> | null
) {
  if (currentPhaseId === null) return false
  if (ownerType === "competitions") {
    return row.competitionId === ownerId && row.phaseId === currentPhaseId
  }
  return row.projectId === ownerId && row.phaseId === currentPhaseId
}

function isBlockedOpenTask(row: TaskBoardRow) {
  return isNonBacklogOpenTask(row) && row.blockers.openCount > 0
}

function rowOwnerRef(row: TaskBoardRow): CompetitionOrProjectRef | null {
  if (row.competitionId !== null) {
    return { type: "competitions", id: row.competitionId }
  }
  if (row.projectId !== null) {
    return { type: "projects", id: row.projectId }
  }
  return null
}

function ownerCurrentPhaseId(
  row: TaskBoardRow,
  competitionPhaseById: Map<Id<"competitions">, Id<"phases"> | null>,
  projectPhaseById: Map<Id<"projects">, Id<"phases"> | null>
): Id<"phases"> | null {
  const owner = rowOwnerRef(row)
  if (owner === null) return null
  return currentPhaseIdForOwner(owner, competitionPhaseById, projectPhaseById)
}

function isOverdueOpenTask(
  row: TaskBoardRow,
  competitionPhaseById: Map<Id<"competitions">, Id<"phases"> | null>,
  projectPhaseById: Map<Id<"projects">, Id<"phases"> | null>,
  phaseSortKeyById: Map<Id<"phases">, string>,
  today: string
) {
  return isTaskOverdue({
    effectiveStatus: row.statusView.effectiveStatus,
    dueDate: row.task.dueDate,
    phaseId: row.phaseId,
    subtaskTitleId: row.path.subtaskTitleId,
    competitionId: row.competitionId,
    projectId: row.projectId,
    ownerCurrentPhaseId: ownerCurrentPhaseId(
      row,
      competitionPhaseById,
      projectPhaseById
    ),
    phaseSortKeyById,
    today,
  })
}

function isTaskRowSteward(
  principal: Principal,
  row: TaskBoardRow,
  competitionById: Map<Id<"competitions">, Doc<"competitions">>,
  projectById: Map<Id<"projects">, Doc<"projects">>
) {
  if (row.competitionId !== null) {
    return isCompetitionSteward(
      principal,
      competitionById.get(row.competitionId)
    )
  }
  if (row.projectId !== null) {
    const project = projectById.get(row.projectId)
    return project !== undefined && isProjectLead(principal, project)
  }
  return false
}

function countOwnerPhaseWork<
  OwnerId extends Id<"competitions"> | Id<"projects">,
>(
  owners: { _id: OwnerId; phaseId: Id<"phases"> | null }[],
  rows: TaskBoardRow[],
  ownerType: CompetitionOrProjectRef["type"],
  competitionPhaseById: Map<Id<"competitions">, Id<"phases"> | null>,
  projectPhaseById: Map<Id<"projects">, Id<"phases"> | null>,
  phaseSortKeyById: Map<Id<"phases">, string>,
  today: string,
  matchesOwner: (row: TaskBoardRow, ownerId: OwnerId) => boolean
) {
  const activeTaskCounts = new Map<OwnerId, number>()
  const blockedTaskCounts = new Map<OwnerId, number>()
  const overdueTaskCounts = new Map<OwnerId, number>()

  for (const owner of owners) {
    if (owner.phaseId === null) continue

    let active = 0
    let blocked = 0
    let overdue = 0

    for (const row of rows) {
      if (!matchesOwner(row, owner._id)) continue
      if (
        isOverdueOpenTask(
          row,
          competitionPhaseById,
          projectPhaseById,
          phaseSortKeyById,
          today
        )
      ) {
        overdue += 1
      }
      if (!isInOwnerCurrentPhase(row, owner._id, ownerType, owner.phaseId)) {
        continue
      }
      if (!isNonBacklogOpenTask(row)) continue
      active += 1
      if (isBlockedOpenTask(row)) blocked += 1
    }

    if (active === 0) continue

    activeTaskCounts.set(owner._id, active)
    blockedTaskCounts.set(owner._id, blocked)
    overdueTaskCounts.set(owner._id, overdue)
  }

  return { activeTaskCounts, blockedTaskCounts, overdueTaskCounts }
}

function countCompetitionPhaseWork(
  competitions: Doc<"competitions">[],
  rows: TaskBoardRow[],
  competitionPhaseById: Map<Id<"competitions">, Id<"phases"> | null>,
  projectPhaseById: Map<Id<"projects">, Id<"phases"> | null>,
  phaseSortKeyById: Map<Id<"phases">, string>,
  today: string
) {
  return countOwnerPhaseWork(
    competitions,
    rows,
    "competitions",
    competitionPhaseById,
    projectPhaseById,
    phaseSortKeyById,
    today,
    (row, ownerId) => row.competitionId === ownerId
  )
}

function countProjectPhaseWork(
  projects: Doc<"projects">[],
  rows: TaskBoardRow[],
  competitionPhaseById: Map<Id<"competitions">, Id<"phases"> | null>,
  projectPhaseById: Map<Id<"projects">, Id<"phases"> | null>,
  phaseSortKeyById: Map<Id<"phases">, string>,
  today: string
) {
  return countOwnerPhaseWork(
    projects,
    rows,
    "projects",
    competitionPhaseById,
    projectPhaseById,
    phaseSortKeyById,
    today,
    (row, ownerId) => row.projectId === ownerId
  )
}

function isAssignedToUser(row: TaskBoardRow, userId: Id<"users">) {
  return row.assignees.userIds.includes(userId)
}

function blockedActiveTasksByBlockingTask(
  blockers: Doc<"taskBlockers">[],
  activeRowByTaskId: Map<Id<"tasks">, TaskBoardRow>
) {
  const blockedTasks = new Map<
    Id<"tasks">,
    { _id: Id<"tasks">; name: string }[]
  >()
  for (const blocker of blockers) {
    const blockedRow = activeRowByTaskId.get(blocker.blockedTaskId)
    if (!blockedRow) continue
    const entries = blockedTasks.get(blocker.blockingTaskId) ?? []
    entries.push({
      _id: blockedRow.task._id,
      name: blockedRow.path.taskTitle,
    })
    blockedTasks.set(blocker.blockingTaskId, entries)
  }
  return blockedTasks
}

function hasStatusOption(
  row: TaskBoardRow,
  status: TaskStatusCommand
): boolean {
  return row.statusView.statusOptions.includes(status)
}

function isOwnedByUserOrTeam(
  row: TaskBoardRow,
  userId: Id<"users">,
  teamIds: ReadonlySet<Id<"teams">>
) {
  if (row.owner === null) return false
  if (row.owner.type === "users") return row.owner._id === userId
  return teamIds.has(row.owner._id)
}

function primaryActionForBlockingTask(row: TaskBoardRow): TaskPrimaryAction {
  if (
    (row.statusView.effectiveStatus === "to-do" ||
      row.statusView.effectiveStatus === "backlog") &&
    hasStatusOption(row, "in-progress")
  ) {
    return "start"
  }

  if (
    row.statusView.effectiveStatus === "in-progress" &&
    hasStatusOption(row, "done")
  ) {
    return "complete"
  }

  return "open-task"
}

function formatBlockedTaskExplanation(blockedTasks: { name: string }[]) {
  if (blockedTasks.length === 0) return "Blocking other active work."
  if (blockedTasks.length === 1) return `Blocking ${blockedTasks[0].name}.`
  const [first, second] = blockedTasks
  if (blockedTasks.length === 2) {
    return `Blocking ${first.name} and ${second.name}.`
  }
  return `Blocking ${first.name}, ${second.name}, and ${String(
    blockedTasks.length - 2
  )} more.`
}

function ownerLabel(row: TaskBoardRow, userId: Id<"users">) {
  if (row.owner === null) return "No owner"
  if (row.owner.type === "users") {
    return row.owner._id === userId ? "You" : (row.owner.name ?? "Someone")
  }
  return row.owner.name
}

function overdueExplanation(row: TaskBoardRow) {
  if (row.task.dueDate !== null) {
    return `This task is overdue. Due ${row.task.dueDate}.`
  }
  return "This task is overdue."
}

function overdueTaskAction(row: TaskBoardRow): Omit<TaskAction, "task"> {
  return {
    reason: "overdue",
    reasonLabel: "Overdue",
    primaryAction: "open-task",
    explanation: overdueExplanation(row),
  }
}

function classifyTaskAction(
  row: TaskBoardRow,
  userId: Id<"users">,
  teamIds: ReadonlySet<Id<"teams">>,
  pendingReviewTaskIds: ReadonlySet<Id<"tasks">>,
  blockedActiveTasks: Map<Id<"tasks">, { _id: Id<"tasks">; name: string }[]>,
  watcherIdsByTaskId: Map<Id<"tasks">, Set<Id<"users">>>,
  competitionPhaseById: Map<Id<"competitions">, Id<"phases"> | null>,
  projectPhaseById: Map<Id<"projects">, Id<"phases"> | null>,
  phaseSortKeyById: Map<Id<"phases">, string>,
  today: string
): Omit<TaskAction, "task"> | null {
  const assignedToUser = isAssignedToUser(row, userId)
  const ownedByUserOrTeam = isOwnedByUserOrTeam(row, userId, teamIds)
  const mine = assignedToUser || ownedByUserOrTeam
  const blockedTasks = blockedActiveTasks.get(row.task._id) ?? []

  if (
    pendingReviewTaskIds.has(row.task._id) &&
    row.statusView.effectiveStatus === "awaiting-review"
  ) {
    return {
      reason: "review",
      reasonLabel: "Awaiting your review",
      primaryAction: "view",
      explanation: "Your review is needed before this can move on.",
    }
  }

  if (
    mine &&
    blockedTasks.length > 0 &&
    row.statusView.effectiveStatus !== "backlog"
  ) {
    return {
      reason: "blocking",
      reasonLabel: "Blocking",
      primaryAction: primaryActionForBlockingTask(row),
      explanation: formatBlockedTaskExplanation(blockedTasks),
    }
  }

  if (
    isTaskWatcher(watcherIdsByTaskId, row.task._id, userId) &&
    isOverdueOpenTask(
      row,
      competitionPhaseById,
      projectPhaseById,
      phaseSortKeyById,
      today
    )
  ) {
    return overdueTaskAction(row)
  }

  if (
    ownedByUserOrTeam &&
    row.assignees.mode === "assignable" &&
    row.statusView.effectiveStatus !== "backlog"
  ) {
    const label = ownerLabel(row, userId)
    return {
      reason: "unassigned-owned",
      reasonLabel: "Needs assignee",
      primaryAction: "claim",
      explanation:
        label === "You"
          ? "You own this, no assignee."
          : `${label} owns this, no assignee.`,
    }
  }

  if (assignedToUser && row.statusView.effectiveStatus === "in-progress") {
    return {
      reason: "in-progress",
      reasonLabel: "In progress",
      primaryAction: hasStatusOption(row, "done") ? "complete" : "open-task",
      explanation: hasStatusOption(row, "done")
        ? "Ready to finish from here."
        : "Continue this task.",
    }
  }

  if (assignedToUser && row.statusView.effectiveStatus === "to-do") {
    return {
      reason: "assigned-todo",
      reasonLabel: "Ready to start",
      primaryAction: "start",
      explanation: "Assigned to you.",
    }
  }

  if (assignedToUser && row.statusView.effectiveStatus !== "backlog") {
    return {
      reason: "assigned-open",
      reasonLabel: "Assigned to you",
      primaryAction: "open-task",
      explanation: "This active task is assigned to you.",
    }
  }

  return null
}

const TASK_ACTION_PRIORITY = {
  review: 0,
  blocking: 1,
  overdue: 2,
  "unassigned-owned": 3,
  "in-progress": 4,
  "assigned-todo": 5,
  "assigned-open": 6,
} satisfies Record<TaskActionReason, number>

function sortTaskActions(actions: TaskAction[]): TaskAction[] {
  return [...actions].sort((left, right) => {
    const reasonRank =
      TASK_ACTION_PRIORITY[left.reason] - TASK_ACTION_PRIORITY[right.reason]
    if (reasonRank !== 0) return reasonRank

    const leftDue = left.task.task.dueDate ?? "9999-12-31"
    const rightDue = right.task.task.dueDate ?? "9999-12-31"
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue)

    return left.task.path.taskTitle.localeCompare(right.task.path.taskTitle)
  })
}

function isActionNeeded(action: TaskAction) {
  return (
    action.reason === "review" ||
    action.reason === "blocking" ||
    action.reason === "overdue" ||
    action.reason === "unassigned-owned"
  )
}

function sortCompetitionsWithWork(
  competitions: Doc<"competitions">[],
  blockedTaskCounts: Map<Id<"competitions">, number>,
  overdueTaskCounts: Map<Id<"competitions">, number>,
  activeTaskCounts: Map<Id<"competitions">, number>
) {
  return [...competitions].sort((left, right) => {
    const leftDate = competitionPrimaryStart(left.compDates) ?? "9999-12-31"
    const rightDate = competitionPrimaryStart(right.compDates) ?? "9999-12-31"
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate)

    const leftRisk =
      (blockedTaskCounts.get(left._id) ?? 0) +
      (overdueTaskCounts.get(left._id) ?? 0)
    const rightRisk =
      (blockedTaskCounts.get(right._id) ?? 0) +
      (overdueTaskCounts.get(right._id) ?? 0)
    if (leftRisk !== rightRisk) return rightRisk - leftRisk

    const activeDelta =
      (activeTaskCounts.get(right._id) ?? 0) -
      (activeTaskCounts.get(left._id) ?? 0)
    if (activeDelta !== 0) return activeDelta

    return left.name.localeCompare(right.name)
  })
}

function sortProjectsWithWork(
  projects: Doc<"projects">[],
  blockedTaskCounts: Map<Id<"projects">, number>,
  overdueTaskCounts: Map<Id<"projects">, number>,
  activeTaskCounts: Map<Id<"projects">, number>
) {
  return [...projects].sort((left, right) => {
    const leftRisk =
      (blockedTaskCounts.get(left._id) ?? 0) +
      (overdueTaskCounts.get(left._id) ?? 0)
    const rightRisk =
      (blockedTaskCounts.get(right._id) ?? 0) +
      (overdueTaskCounts.get(right._id) ?? 0)
    if (leftRisk !== rightRisk) return rightRisk - leftRisk

    const activeDelta =
      (activeTaskCounts.get(right._id) ?? 0) -
      (activeTaskCounts.get(left._id) ?? 0)
    if (activeDelta !== 0) return activeDelta

    return left.name.localeCompare(right.name)
  })
}

function buildProjectWorkSummary(
  project: Doc<"projects">,
  phaseById: Map<Id<"phases">, Doc<"phases">>,
  activeTaskCounts: Map<Id<"projects">, number>,
  blockedTaskCounts: Map<Id<"projects">, number>,
  overdueTaskCounts: Map<Id<"projects">, number>
) {
  return {
    _id: project._id,
    name: project.name,
    phase: phaseSnapshot(
      project.phaseId ? phaseById.get(project.phaseId) : null
    ),
    activeTaskCount: activeTaskCounts.get(project._id) ?? 0,
    blockedTaskCount: blockedTaskCounts.get(project._id) ?? 0,
    overdueTaskCount: overdueTaskCounts.get(project._id) ?? 0,
  }
}

function buildCompetitionWorkSummary(
  competition: Doc<"competitions">,
  phaseById: Map<Id<"phases">, Doc<"phases">>,
  activeTaskCounts: Map<Id<"competitions">, number>,
  blockedTaskCounts: Map<Id<"competitions">, number>,
  overdueTaskCounts: Map<Id<"competitions">, number>
) {
  return {
    _id: competition._id,
    name: competition.name,
    compDates: competition.compDates,
    phase: phaseSnapshot(
      competition.phaseId ? phaseById.get(competition.phaseId) : null
    ),
    activeTaskCount: activeTaskCounts.get(competition._id) ?? 0,
    blockedTaskCount: blockedTaskCounts.get(competition._id) ?? 0,
    overdueTaskCount: overdueTaskCounts.get(competition._id) ?? 0,
  }
}

export const getHome = query({
  args: {},
  returns: v.object({
    actionNeeded: v.array(taskActionValidator),
    assignedWork: v.array(taskActionValidator),
    stewardOverdue: v.array(taskActionValidator),
    competitionsWithWork: v.array(competitionWorkSummaryValidator),
    projectsWithWork: v.array(projectWorkSummaryValidator),
  }),
  handler: async (ctx) => {
    const principal = await requirePrincipal(ctx)
    const today = dublinToday()
    const [
      taskRows,
      competitions,
      projects,
      phases,
      teams,
      taskReviewers,
      taskBlockers,
      subscriptions,
      tasks,
    ] = await Promise.all([
      buildTaskBoardRows(ctx),
      collectAll(ctx, "competitions"),
      collectAll(ctx, "projects"),
      collectAll(ctx, "phases"),
      collectAll(ctx, "teams"),
      collectAll(ctx, "taskReviewers"),
      collectAll(ctx, "taskBlockers"),
      collectAll(ctx, "subscriptions"),
      collectAll(ctx, "tasks"),
    ])
    const teamIds = teamIdsForTeamNames(teams, new Set(principal.teamNames))
    const { competitionPhaseById, projectPhaseById, phaseSortKeyById } =
      buildOwnerPhaseScanContext(competitions, projects, phases)
    const competitionById = new Map(
      competitions.map((competition) => [competition._id, competition])
    )
    const projectById = new Map(
      projects.map((project) => [project._id, project])
    )
    const watcherIdsByTaskId = buildTaskWatcherIdsByTaskId(tasks, subscriptions)

    const readableCompetitions = competitions.filter((competition) =>
      canPerform(principal, "read", "Competition", competition)
    )
    const readableCompetitionIds = new Set(
      readableCompetitions.map((competition) => competition._id)
    )
    const readableProjectIds = new Set<Id<"projects">>()
    const readableProjects: Doc<"projects">[] = []
    await Promise.all(
      projects.map(async (project) => {
        if (await canReadProject(ctx, principal, project)) {
          readableProjectIds.add(project._id)
          readableProjects.push(project)
        }
      })
    )
    const openRows = taskRows.filter(
      (row) =>
        isActiveTask(row) &&
        (row.competitionId === null ||
          readableCompetitionIds.has(row.competitionId)) &&
        (row.projectId === null || readableProjectIds.has(row.projectId))
    )
    const activeRows = openRows.filter(isNonBacklogOpenTask)
    const activeRowByTaskId = new Map(
      activeRows.map((row) => [row.task._id, row])
    )
    const pendingReviewTaskIds = pendingReviewTaskIdsForPrincipal(
      taskReviewers,
      principal.userId,
      teamIds
    )
    const blockedActiveTasks = blockedActiveTasksByBlockingTask(
      taskBlockers,
      activeRowByTaskId
    )

    const taskActions = sortTaskActions(
      openRows.flatMap((row) => {
        const action = classifyTaskAction(
          row,
          principal.userId,
          teamIds,
          pendingReviewTaskIds,
          blockedActiveTasks,
          watcherIdsByTaskId,
          competitionPhaseById,
          projectPhaseById,
          phaseSortKeyById,
          today
        )
        if (action === null) return []
        return [{ ...action, task: row }]
      })
    )
    const actionNeeded = taskActions.filter(isActionNeeded)
    const assignedWork = taskActions.filter(
      (action) =>
        isAssignedToUser(action.task, principal.userId) &&
        !isActionNeeded(action)
    )
    const actionNeededTaskIds = new Set(
      actionNeeded.map((action) => action.task.task._id)
    )
    const stewardOverdue = sortTaskActions(
      openRows.flatMap((row) => {
        if (actionNeededTaskIds.has(row.task._id)) return []
        if (!isTaskRowSteward(principal, row, competitionById, projectById)) {
          return []
        }
        if (
          row.competitionId !== null &&
          !readableCompetitionIds.has(row.competitionId)
        ) {
          return []
        }
        if (row.projectId !== null && !readableProjectIds.has(row.projectId)) {
          return []
        }
        if (
          !isOverdueOpenTask(
            row,
            competitionPhaseById,
            projectPhaseById,
            phaseSortKeyById,
            today
          )
        ) {
          return []
        }
        return [{ ...overdueTaskAction(row), task: row }]
      })
    ).slice(0, STEWARD_OVERDUE_LIMIT)

    const { activeTaskCounts, blockedTaskCounts, overdueTaskCounts } =
      countCompetitionPhaseWork(
        readableCompetitions,
        openRows,
        competitionPhaseById,
        projectPhaseById,
        phaseSortKeyById,
        today
      )
    const {
      activeTaskCounts: projectActiveTaskCounts,
      blockedTaskCounts: projectBlockedTaskCounts,
      overdueTaskCounts: projectOverdueTaskCounts,
    } = countProjectPhaseWork(
      readableProjects,
      openRows,
      competitionPhaseById,
      projectPhaseById,
      phaseSortKeyById,
      today
    )
    const phaseById = new Map(phases.map((phase) => [phase._id, phase]))
    const competitionsWithWork = sortCompetitionsWithWork(
      readableCompetitions.filter(
        (competition) => (activeTaskCounts.get(competition._id) ?? 0) > 0
      ),
      blockedTaskCounts,
      overdueTaskCounts,
      activeTaskCounts
    )
      .slice(0, COMPETITION_LIMIT)
      .map((competition) =>
        buildCompetitionWorkSummary(
          competition,
          phaseById,
          activeTaskCounts,
          blockedTaskCounts,
          overdueTaskCounts
        )
      )

    const projectsWithWork = sortProjectsWithWork(
      readableProjects.filter(
        (project) => (projectActiveTaskCounts.get(project._id) ?? 0) > 0
      ),
      projectBlockedTaskCounts,
      projectOverdueTaskCounts,
      projectActiveTaskCounts
    )
      .slice(0, PROJECT_LIMIT)
      .map((project) =>
        buildProjectWorkSummary(
          project,
          phaseById,
          projectActiveTaskCounts,
          projectBlockedTaskCounts,
          projectOverdueTaskCounts
        )
      )

    return {
      actionNeeded,
      assignedWork,
      stewardOverdue,
      competitionsWithWork,
      projectsWithWork,
    }
  },
})
