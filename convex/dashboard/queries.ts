import { collectAll } from "@/convex/utils"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { query } from "@/convex/_generated/server"
import {
  competitionPhaseSnapshot,
  competitionPhaseValidator,
} from "@/convex/competitions/phaseSnapshot"
import { todayIsoDate } from "@/convex/competitions/dates"
import { canPerform, requirePrincipal } from "@/convex/permissions/principal"
import { teamIdsForTeamNames } from "@/convex/teams/model"
import { buildTaskBoardRows, taskBoardRow } from "@/convex/tasks/board"
import { pendingReviewTaskIdsForPrincipal } from "@/convex/tasks/reviews/reviewState"
import type { TaskStatusCommand } from "@/convex/tasks/status/rules"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { v, type Infer } from "convex/values"

const COMPETITION_LIMIT = 6

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
  phase: competitionPhaseValidator,
  activeTaskCount: v.number(),
  blockedTaskCount: v.number(),
  overdueTaskCount: v.number(),
})

function isActiveTask(row: TaskBoardRow) {
  return !isTerminalComplete(row.statusView.effectiveStatus)
}

function isAssignedToUser(row: TaskBoardRow, userId: Id<"users">) {
  return row.assignees.userIds.includes(userId)
}

function isOverdue(row: TaskBoardRow, today: string) {
  return row.task.dueDate !== null && row.task.dueDate < today
}

function countByCompetition(
  rows: TaskBoardRow[],
  predicate: (row: TaskBoardRow) => boolean
) {
  const counts = new Map<Id<"competitions">, number>()
  for (const row of rows) {
    if (row.competitionId === null || !predicate(row)) continue
    counts.set(row.competitionId, (counts.get(row.competitionId) ?? 0) + 1)
  }
  return counts
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

function hasStatusOption(row: TaskBoardRow, status: TaskStatusCommand): boolean {
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

function classifyTaskAction(
  row: TaskBoardRow,
  userId: Id<"users">,
  teamIds: ReadonlySet<Id<"teams">>,
  pendingReviewTaskIds: ReadonlySet<Id<"tasks">>,
  blockedActiveTasks: Map<Id<"tasks">, { _id: Id<"tasks">; name: string }[]>,
  today: string
): Omit<TaskAction, "task"> | null {
  const assignedToUser = isAssignedToUser(row, userId)
  const ownedByUserOrTeam = isOwnedByUserOrTeam(row, userId, teamIds)
  const mine = assignedToUser || ownedByUserOrTeam
  const blockedTasks = blockedActiveTasks.get(row.task._id) ?? []

  if (pendingReviewTaskIds.has(row.task._id)) {
    return {
      reason: "review",
      reasonLabel: "Awaiting your review",
      primaryAction: "view",
      explanation: "Your review is needed before this can move on.",
    }
  }

  if (mine && blockedTasks.length > 0) {
    return {
      reason: "blocking",
      reasonLabel: "Blocking",
      primaryAction: primaryActionForBlockingTask(row),
      explanation: formatBlockedTaskExplanation(blockedTasks),
    }
  }

  if (assignedToUser && isOverdue(row, today)) {
    return {
      reason: "overdue",
      reasonLabel: "Overdue",
      primaryAction: "open-task",
      explanation: `Due ${row.task.dueDate ?? "already"}.`,
    }
  }

  if (ownedByUserOrTeam && row.assignees.mode !== "assigned") {
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

  if (
    assignedToUser &&
    (row.statusView.effectiveStatus === "to-do" ||
      row.statusView.effectiveStatus === "backlog")
  ) {
    return {
      reason: "assigned-todo",
      reasonLabel: "Ready to start",
      primaryAction: "start",
      explanation: "Assigned to you.",
    }
  }

  if (assignedToUser) {
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
    phase: competitionPhaseSnapshot(
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
    competitionsWithWork: v.array(competitionWorkSummaryValidator),
  }),
  handler: async (ctx) => {
    const principal = await requirePrincipal(ctx)
    const today = todayIsoDate()
    const [taskRows, competitions, phases, teams, taskReviewers, taskBlockers] =
      await Promise.all([
        buildTaskBoardRows(ctx),
        collectAll(ctx, "competitions"),
        collectAll(ctx, "phases"),
        collectAll(ctx, "teams"),
        collectAll(ctx, "taskReviewers"),
        collectAll(ctx, "taskBlockers"),
      ])
    const teamIds = teamIdsForTeamNames(teams, new Set(principal.teamNames))

    const readableCompetitions = competitions.filter((competition) =>
      canPerform(principal, "read", "Competition", competition)
    )
    const readableCompetitionIds = new Set(
      readableCompetitions.map((competition) => competition._id)
    )
    const activeRows = taskRows.filter(
      (row) =>
        isActiveTask(row) &&
        (row.competitionId === null ||
          readableCompetitionIds.has(row.competitionId))
    )
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
      activeRows.flatMap((row) => {
        const action = classifyTaskAction(
          row,
          principal.userId,
          teamIds,
          pendingReviewTaskIds,
          blockedActiveTasks,
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

    const activeTaskCounts = countByCompetition(activeRows, () => true)
    const blockedTaskCounts = countByCompetition(
      activeRows,
      (row) => row.blockers.openCount > 0
    )
    const overdueTaskCounts = countByCompetition(activeRows, (row) =>
      isOverdue(row, today)
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

    return {
      actionNeeded,
      assignedWork,
      competitionsWithWork,
    }
  },
})
