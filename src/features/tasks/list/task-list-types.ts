import type { Id } from "@/convex/_generated/dataModel"
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

export const TASK_LIST_PRESET_IDS = [
  "active",
  "all",
  "my-tasks",
  "unassigned",
] as const

export type TaskListPresetId = (typeof TASK_LIST_PRESET_IDS)[number]

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
  activePresetId: TaskListPresetId | null
  activeViewId: string | null
  overlayFilters: TasksFilters
  overlayMatchMode?: MatchMode
  display: DisplaySettings
}

export interface TaskListViewSnapshot {
  baselineFilters: TasksFilters
  baselineMatchMode: MatchMode
  display: DisplaySettings
  activeViewId: Id<"savedViews"> | null
  activePresetId: TaskListPresetId | null
}

function countActiveFilterTypes(filters: TasksFilters): number {
  let count = 0
  for (const key of TASK_FILTER_ARRAY_KEYS) {
    if (filters[key].length > 0) count += 1
  }
  if (hasDateRangeValue(filters.dueDate)) count += 1
  return count
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
