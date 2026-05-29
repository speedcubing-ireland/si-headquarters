import type { DisplaySettings, MatchMode } from "@/features/list-views/types"
import { defaultDisplaySettings } from "@/features/list-views/types"
import {
  emptyTasksFilters,
  TASK_FILTER_ARRAY_KEYS,
  type TasksFilters,
} from "@/features/tasks/list/task-list-types"

export function serializeTaskFilters(
  filters: TasksFilters,
  matchMode: MatchMode
): string {
  return JSON.stringify({ filters, matchMode })
}

export function parseTasksFiltersJson(json: string): {
  filters: TasksFilters
  matchMode: MatchMode
} {
  try {
    const data = JSON.parse(json) as Partial<{
      filters: TasksFilters
      matchMode: MatchMode
    }>
    return {
      filters: data.filters ?? emptyTasksFilters,
      matchMode: data.matchMode ?? "all",
    }
  } catch {
    return { filters: emptyTasksFilters, matchMode: "all" }
  }
}

export function serializeDisplaySettings(settings: DisplaySettings): string {
  return JSON.stringify(settings)
}

export function parseDisplaySettingsJson(json: string): DisplaySettings {
  try {
    const data = JSON.parse(json) as Partial<DisplaySettings>
    const ordering = data.ordering ?? defaultDisplaySettings.ordering
    return {
      mode: data.mode === "kanban" ? "kanban" : "list",
      grouping: data.grouping ?? null,
      ordering: {
        field: ordering.field ?? null,
        direction: ordering.direction === "desc" ? "desc" : "asc",
      },
    }
  } catch {
    return { ...defaultDisplaySettings }
  }
}

export function cloneTasksFilters(filters: TasksFilters): TasksFilters {
  const next = { ...filters }
  for (const key of TASK_FILTER_ARRAY_KEYS) {
    next[key] = filters[key].map((item) => ({
      values: [...item.values],
      isNot: item.isNot,
    }))
  }
  if (filters.dueDate) {
    next.dueDate = { ...filters.dueDate }
  }
  return next
}
