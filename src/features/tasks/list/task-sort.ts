import {
  compareStrings,
  createRowSorter,
} from "@/features/list-views/row-sorter"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"
import { TASK_STATUS_ORDER } from "@/features/tasks/status"

const STATUS_RANK: ReadonlyMap<string, number> = new Map(
  TASK_STATUS_ORDER.map((status, index) => [status, index] as const)
)

export function taskStatusRank(status: string) {
  return STATUS_RANK.get(status) ?? TASK_STATUS_ORDER.length
}

function assigneeSortKey(row: TaskBoardRow): string {
  const primary = row.assignees.primaryUser
  if (row.assignees.mode === "assigned" && primary) {
    return primary.name ?? primary._id
  }
  return row.assignees.mode
}

function ownerSortKey(row: TaskBoardRow): string {
  if (row.owner === null) return ""
  return row.owner.type === "users"
    ? (row.owner.name ?? row.owner._id)
    : row.owner.name
}

export const sortTaskRows = createRowSorter<TaskBoardRow>({
  name: (left, right) => compareStrings(left.task.name, right.task.name),
  status: (left, right) =>
    taskStatusRank(left.statusView.effectiveStatus) -
    taskStatusRank(right.statusView.effectiveStatus),
  dueDate: (left, right) =>
    compareStrings(left.task.dueDate, right.task.dueDate),
  kind: (left, right) => compareStrings(left.task.kind, right.task.kind),
  assignee: (left, right) =>
    compareStrings(assigneeSortKey(left), assigneeSortKey(right)),
  owner: (left, right) =>
    compareStrings(ownerSortKey(left), ownerSortKey(right)),
  competition: (left, right) =>
    compareStrings(left.competitionName, right.competitionName),
  phase: (left, right) => compareStrings(left.phaseName, right.phaseName),
})
