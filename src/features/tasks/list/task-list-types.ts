import { hasDateRangeValue } from "@/features/list-views/types"
import type {
  DateRangeFilter,
  DisplaySettings,
  FilterItem,
  MatchMode,
} from "@/features/list-views/types"

export interface TasksFilters {
  status: FilterItem[]
  kind: FilterItem[]
  assignee: FilterItem[]
  owner: FilterItem[]
  labels: FilterItem[]
  competition: FilterItem[]
  phase: FilterItem[]
  dueDate?: DateRangeFilter
}

export const emptyTasksFilters: TasksFilters = {
  status: [],
  kind: [],
  assignee: [],
  owner: [],
  labels: [],
  competition: [],
  phase: [],
}

export const TASK_FILTER_ARRAY_KEYS = [
  "status",
  "kind",
  "assignee",
  "owner",
  "labels",
  "competition",
  "phase",
] as const satisfies readonly (keyof TasksFilters)[]

export type TaskFilterKey = (typeof TASK_FILTER_ARRAY_KEYS)[number]

export interface TaskListPageSnapshot {
  filters: TasksFilters
  matchMode: MatchMode
  display: DisplaySettings
}

function countActiveFilterTypes(filters: TasksFilters): number {
  let count = 0
  for (const key of TASK_FILTER_ARRAY_KEYS) {
    if (filters[key].length > 0) count += 1
  }
  if (hasDateRangeValue(filters.dueDate)) count += 1
  return count
}

export function hasActiveTaskFilters(filters: TasksFilters): boolean {
  return countActiveFilterTypes(filters) > 0
}

export function countActiveTaskFilterChips(filters: TasksFilters): number {
  let count = 0
  for (const key of TASK_FILTER_ARRAY_KEYS) {
    count += filters[key].length
  }
  if (hasDateRangeValue(filters.dueDate)) count += 1
  return count
}

export function shouldShowTaskMatchModeToggle(filters: TasksFilters): boolean {
  return countActiveFilterTypes(filters) >= 2
}
