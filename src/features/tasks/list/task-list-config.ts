import type { Id } from "@/convex/_generated/dataModel"
import type { MatchMode } from "@/features/list-views/types"
import { hasDateRangeValue } from "@/features/list-views/types"
import { TASK_LIST_ACTIVE_STATUSES } from "@/features/tasks/status"
import {
  cloneTasksFilters,
  serializeTaskFilters,
} from "@/features/tasks/list/task-list-serialize"
import {
  emptyTasksFilters,
  TASK_FILTER_ARRAY_KEYS,
  type TaskListPresetId,
  type TasksFilters,
} from "@/features/tasks/list/task-list-types"

export type TaskListScope =
  | { type: "global" }
  | { type: "team"; teamId: Id<"teams">; teamName?: string }

export interface TaskListPageConfig {
  pageId: string
  title: string
  scope: TaskListScope
  presets: TaskListPresetId[]
  defaultPreset: TaskListPresetId
}

export function taskListPageTitle(teamName?: string): string {
  if (teamName === undefined) return "Tasks"
  return `${teamName} Tasks`
}

export const GLOBAL_TASK_LIST_CONFIG: TaskListPageConfig = {
  pageId: "all",
  title: taskListPageTitle(),
  scope: { type: "global" },
  presets: ["my-tasks", "active", "all"],
  defaultPreset: "my-tasks",
}

export function teamTaskListConfig(
  teamId: Id<"teams">,
  teamName: string
): TaskListPageConfig {
  return {
    pageId: `team:${teamId}`,
    title: taskListPageTitle(teamName),
    scope: { type: "team", teamId, teamName },
    presets: ["active", "unassigned", "all"],
    defaultPreset: "active",
  }
}

export const TASK_LIST_PRESET_LABELS: Record<TaskListPresetId, string> = {
  active: "Active",
  all: "All",
  "my-tasks": "My Tasks",
  unassigned: "Unassigned",
}

function activeStatusFilter() {
  return [{ values: [...TASK_LIST_ACTIVE_STATUSES], isNot: false }]
}

export function getPresetSnapshot(
  presetId: TaskListPresetId,
  userId: Id<"users"> | null
): { filters: TasksFilters; matchMode: MatchMode } {
  const base = cloneTasksFilters(emptyTasksFilters)
  const active = {
    filters: { ...base, status: activeStatusFilter() },
    matchMode: "all" as const,
  }

  switch (presetId) {
    case "active":
      return active
    case "all":
      return { filters: base, matchMode: "all" }
    case "my-tasks":
      if (userId === null) return active
      return {
        filters: {
          ...base,
          status: activeStatusFilter(),
          assignee: [{ values: [userId], isNot: false }],
        },
        matchMode: "all",
      }
    case "unassigned":
      return {
        filters: {
          ...base,
          status: activeStatusFilter(),
          assignee: [{ values: ["unassigned"], isNot: false }],
        },
        matchMode: "all",
      }
  }
}

export function mergeScopeFilters(
  scope: TaskListScope,
  filters: TasksFilters
): TasksFilters {
  if (scope.type === "global") return filters
  return {
    ...filters,
    owner: [{ values: [`teams:${scope.teamId}`], isNot: false }],
  }
}

export function stripScopeFromFilters(
  scope: TaskListScope,
  filters: TasksFilters
): TasksFilters {
  if (scope.type === "global") return filters
  const teamValue = `teams:${scope.teamId}`
  return {
    ...filters,
    owner: filters.owner
      .map((item) => ({
        ...item,
        values: item.values.filter((value) => value !== teamValue),
      }))
      .filter((item) => item.values.length > 0),
  }
}

export function isTeamScoped(config: TaskListPageConfig): boolean {
  return config.scope.type === "team"
}

export function serializeTaskFiltersForPage(
  scope: TaskListScope,
  filters: TasksFilters,
  matchMode: MatchMode
): string {
  return serializeTaskFilters(stripScopeFromFilters(scope, filters), matchMode)
}

export function emptyOverlayFilters(): TasksFilters {
  return cloneTasksFilters(emptyTasksFilters)
}

export function mergeViewFilters(
  baseline: TasksFilters,
  overlay: TasksFilters
): TasksFilters {
  const merged = cloneTasksFilters(baseline)
  for (const key of TASK_FILTER_ARRAY_KEYS) {
    if (overlay[key].length > 0) {
      merged[key] = [...merged[key], ...overlay[key]]
    }
  }
  if (hasDateRangeValue(overlay.dueDate)) {
    merged.dueDate = overlay.dueDate
  }
  return merged
}

export function hasOverlayFilters(overlay: TasksFilters): boolean {
  for (const key of TASK_FILTER_ARRAY_KEYS) {
    if (overlay[key].length > 0) return true
  }
  return hasDateRangeValue(overlay.dueDate)
}

export function hasOverlayMatchMode(
  baselineMatchMode: MatchMode,
  overlayMatchMode: MatchMode | undefined
): boolean {
  return (
    overlayMatchMode !== undefined && overlayMatchMode !== baselineMatchMode
  )
}

export function resolveMatchMode(
  baselineMatchMode: MatchMode,
  overlayMatchMode: MatchMode | undefined
): MatchMode {
  return overlayMatchMode ?? baselineMatchMode
}
