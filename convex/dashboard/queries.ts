import type { CompetitionOrProjectRef } from "@/convex/utils"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { query } from "@/convex/_generated/server"
import { competitionPrimaryStart } from "@/convex/competitions/dates"
import { phaseSnapshot, phaseSnapshotValidator } from "@/convex/phases/progress"
import {
  isCompetitionSteward,
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import { isProjectLead } from "@/convex/projects/access"
import {
  createTaskBoardReader,
  type TaskBoardSummary,
  taskBoardRow,
} from "@/convex/tasks/boardReader"
import { loadHomeTaskData } from "@/convex/dashboard/homeData"
import {
  buildOwnerPhaseScanContext,
  currentPhaseIdForOwner,
  isTaskOverdue,
  type OwnerPhaseScanContext,
} from "@/convex/tasks/overdue"
import { pendingReviewTaskIdsForPrincipal } from "@/convex/tasks/reviews/reviewState"
import type { TaskStatusCommand } from "@/convex/tasks/status/rules"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { TASK_STATUSES } from "@/convex/tasks/status/validators"
import {
  buildTaskWatcherIdsByTaskId,
  isTaskWatcher,
} from "@/convex/tasks/watchers"
import { v, type Infer } from "convex/values"

const COMPETITION_LIMIT = 6
const PROJECT_LIMIT = 6
const STEWARD_OVERDUE_LIMIT = 20

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
type TaskActionDetails = Omit<Infer<typeof taskActionValidator>, "task">
type TaskActionSummary = TaskActionDetails & {
  task: TaskBoardSummary
}

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

function isNonBacklogOpenTask(row: TaskBoardSummary) {
  return (
    !isTerminalComplete(row.statusView.effectiveStatus) &&
    row.statusView.effectiveStatus !== "backlog"
  )
}

function isInOwnerCurrentPhase(
  row: TaskBoardSummary,
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

function rowOwnerRef(row: TaskBoardSummary): CompetitionOrProjectRef | null {
  if (row.competitionId !== null) {
    return { type: "competitions", id: row.competitionId }
  }
  if (row.projectId !== null) {
    return { type: "projects", id: row.projectId }
  }
  return null
}

function isOverdueOpenTask(row: TaskBoardSummary, context: HomePhaseContext) {
  const owner = rowOwnerRef(row)
  return isTaskOverdue({
    effectiveStatus: row.statusView.effectiveStatus,
    dueDate: row.task.dueDate,
    phaseId: row.phaseId,
    subtaskTitleId: row.path.subtaskTitleId,
    competitionId: row.competitionId,
    projectId: row.projectId,
    ownerCurrentPhaseId:
      owner === null
        ? null
        : currentPhaseIdForOwner(
            owner,
            context.competitionPhaseById,
            context.projectPhaseById
          ),
    phaseSortKeyById: context.phaseSortKeyById,
    today: context.today,
  })
}

function isTaskRowSteward(
  principal: Principal,
  row: TaskBoardSummary,
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
  rows: TaskBoardSummary[],
  ownerType: CompetitionOrProjectRef["type"],
  context: HomePhaseContext
) {
  const activeTaskCounts = new Map<OwnerId, number>()
  const blockedTaskCounts = new Map<OwnerId, number>()
  const overdueTaskCounts = new Map<OwnerId, number>()

  const rowsByOwnerId = new Map<
    Id<"competitions"> | Id<"projects">,
    TaskBoardSummary[]
  >()
  for (const row of rows) {
    const ownerId =
      ownerType === "competitions" ? row.competitionId : row.projectId
    if (ownerId === null) continue
    const ownerRows = rowsByOwnerId.get(ownerId) ?? []
    ownerRows.push(row)
    rowsByOwnerId.set(ownerId, ownerRows)
  }

  for (const owner of owners) {
    if (owner.phaseId === null) continue

    let active = 0
    let blocked = 0
    let overdue = 0

    for (const row of rowsByOwnerId.get(owner._id) ?? []) {
      if (isOverdueOpenTask(row, context)) {
        overdue += 1
      }
      if (!isInOwnerCurrentPhase(row, owner._id, ownerType, owner.phaseId)) {
        continue
      }
      if (!isNonBacklogOpenTask(row)) continue
      active += 1
      if (row.blockers.openCount > 0) blocked += 1
    }

    if (active === 0) continue

    activeTaskCounts.set(owner._id, active)
    blockedTaskCounts.set(owner._id, blocked)
    overdueTaskCounts.set(owner._id, overdue)
  }

  return { activeTaskCounts, blockedTaskCounts, overdueTaskCounts }
}

function isAssignedToUser(row: TaskBoardSummary, userId: Id<"users">) {
  return row.assignees.userIds.includes(userId)
}

function blockedActiveTasksByBlockingTask(
  blockers: Doc<"taskBlockers">[],
  activeRowByTaskId: Map<Id<"tasks">, TaskBoardSummary>
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
  row: TaskBoardSummary,
  status: TaskStatusCommand
): boolean {
  return row.statusView.statusOptions.includes(status)
}

function isOwnedByUserOrTeam(
  row: TaskBoardSummary,
  userId: Id<"users">,
  teamIds: ReadonlySet<Id<"teams">>
) {
  if (row.owner === null) return false
  if (row.owner.type === "users") return row.owner._id === userId
  return teamIds.has(row.owner._id)
}

function primaryActionForBlockingTask(
  row: TaskBoardSummary
): TaskPrimaryAction {
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

function ownerLabel(row: TaskBoardSummary, userId: Id<"users">) {
  if (row.owner === null) return "No owner"
  if (row.owner.type === "users") {
    return row.owner._id === userId ? "You" : (row.owner.name ?? "Someone")
  }
  return row.owner.name
}

function overdueExplanation(row: TaskBoardSummary) {
  if (row.task.dueDate !== null) {
    return `This task is overdue. Due ${row.task.dueDate}.`
  }
  return "This task is overdue."
}

function overdueTaskAction(row: TaskBoardSummary): TaskActionDetails {
  return {
    reason: "overdue",
    reasonLabel: "Overdue",
    primaryAction: "open-task",
    explanation: overdueExplanation(row),
  }
}

interface HomePhaseContext extends OwnerPhaseScanContext {
  today: string
}

interface HomeActionContext {
  userId: Id<"users">
  teamIds: ReadonlySet<Id<"teams">>
  pendingReviewTaskIds: ReadonlySet<Id<"tasks">>
  blockedActiveTasks: Map<Id<"tasks">, { _id: Id<"tasks">; name: string }[]>
  watcherIdsByTaskId: Map<Id<"tasks">, Set<Id<"users">>>
  phases: HomePhaseContext
}

function classifyTaskAction(
  row: TaskBoardSummary,
  context: HomeActionContext
): TaskActionDetails | null {
  const {
    userId,
    teamIds,
    pendingReviewTaskIds,
    blockedActiveTasks,
    watcherIdsByTaskId,
  } = context
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
    isOverdueOpenTask(row, context.phases)
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

function sortTaskActions(actions: TaskActionSummary[]): TaskActionSummary[] {
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

function isActionNeeded(action: TaskActionSummary) {
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
  args: {
    today: v.string(),
  },
  returns: v.object({
    actionNeeded: v.array(taskActionValidator),
    assignedWork: v.array(taskActionValidator),
    stewardOverdue: v.array(taskActionValidator),
    competitionsWithWork: v.array(competitionWorkSummaryValidator),
    projectsWithWork: v.array(projectWorkSummaryValidator),
  }),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const {
      boardData,
      teamIds,
      readableCompetitions,
      readableProjects,
      subscriptions,
    } = await loadHomeTaskData(ctx, principal)
    const {
      tasks,
      competitions,
      projects,
      phases,
      taskReviewers,
      taskBlockers,
    } = boardData
    const phaseById = new Map(phases.map((phase) => [phase._id, phase]))
    if (tasks.length === 0) {
      return {
        actionNeeded: [],
        assignedWork: [],
        stewardOverdue: [],
        competitionsWithWork: [],
        projectsWithWork: [],
      }
    }
    const boardReader = await createTaskBoardReader(ctx, boardData)
    // Classify/count first; only tasks shown on home need labels and subtask summaries.
    const openRows = await boardReader.getSummaries({
      effectiveStatuses: TASK_STATUSES.filter(
        (status) => !isTerminalComplete(status)
      ),
    })
    const phaseContext: HomePhaseContext = {
      ...buildOwnerPhaseScanContext(competitions, projects, phases),
      today: args.today,
    }
    const competitionById = new Map(
      readableCompetitions.map((competition) => [competition._id, competition])
    )
    const projectById = new Map(
      readableProjects.map((project) => [project._id, project])
    )
    const watcherIdsByTaskId = buildTaskWatcherIdsByTaskId(tasks, subscriptions)

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

    const actionContext: HomeActionContext = {
      userId: principal.userId,
      teamIds,
      pendingReviewTaskIds,
      blockedActiveTasks,
      watcherIdsByTaskId,
      phases: phaseContext,
    }
    const taskActions = sortTaskActions(
      openRows.flatMap((row) => {
        const action = classifyTaskAction(row, actionContext)
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
        if (!isOverdueOpenTask(row, phaseContext)) {
          return []
        }
        return [{ ...overdueTaskAction(row), task: row }]
      })
    ).slice(0, STEWARD_OVERDUE_LIMIT)

    const { activeTaskCounts, blockedTaskCounts, overdueTaskCounts } =
      countOwnerPhaseWork(
        readableCompetitions,
        openRows,
        "competitions",
        phaseContext
      )
    const {
      activeTaskCounts: projectActiveTaskCounts,
      blockedTaskCounts: projectBlockedTaskCounts,
      overdueTaskCounts: projectOverdueTaskCounts,
    } = countOwnerPhaseWork(
      readableProjects,
      openRows,
      "projects",
      phaseContext
    )
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

    const displayedActions = [
      ...actionNeeded,
      ...assignedWork,
      ...stewardOverdue,
    ]
    const displayedRows = new Map(
      displayedActions.map((action) => [action.task.task._id, action.task])
    )
    const hydratedRows = await boardReader.hydrateRows([
      ...displayedRows.values(),
    ])
    const hydratedById = new Map(hydratedRows.map((row) => [row.task._id, row]))
    const hydrateActions = (actions: TaskActionSummary[]) =>
      actions.map((action) => {
        const task = hydratedById.get(action.task.task._id)
        if (!task)
          throw new Error("Displayed task missing from hydrated Home rows")
        return { ...action, task }
      })

    return {
      actionNeeded: hydrateActions(actionNeeded),
      assignedWork: hydrateActions(assignedWork),
      stewardOverdue: hydrateActions(stewardOverdue),
      competitionsWithWork,
      projectsWithWork,
    }
  },
})
