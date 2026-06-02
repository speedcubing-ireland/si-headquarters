import type {
  DisplaySettings,
  FilterItem,
  MatchMode,
} from "@/features/list-views/types"
import {
  defaultDisplaySettings,
  hasDateRangeValue,
} from "@/features/list-views/types"
import type { DateRangeFilter } from "@/features/list-views/types"
import {
  emptyTasksFilters,
  TASK_FILTER_ARRAY_KEYS,
  TASK_LIST_PRESET_IDS,
  type TaskListPageSnapshot,
  type TaskListPresetId,
  type TasksFilters,
} from "@/features/tasks/list/task-list-types"
import { isParsedRecord, parseJson, type ParsedJson } from "@/lib/parsed-json"

function parseFilterItem(value: ParsedJson): FilterItem | null {
  if (!isParsedRecord(value)) return null
  if (!Array.isArray(value.values)) return null
  const values = value.values.filter(
    (entry): entry is string => typeof entry === "string"
  )
  if (values.length === 0) return null
  return {
    values,
    isNot: value.isNot === true,
  }
}

function parseFilterItems(value: ParsedJson | undefined): FilterItem[] {
  if (!Array.isArray(value)) return []
  const items: FilterItem[] = []
  for (const entry of value) {
    const item = parseFilterItem(entry)
    if (item !== null) items.push(item)
  }
  return items
}

function parseDateRange(
  value: ParsedJson | undefined
): DateRangeFilter | undefined {
  if (value === undefined || !isParsedRecord(value)) return undefined
  const start = typeof value.start === "string" ? value.start : undefined
  const end = typeof value.end === "string" ? value.end : undefined
  const dateRange: DateRangeFilter = {
    isNot: value.isNot === true ? true : undefined,
    start,
    end,
  }
  return hasDateRangeValue(dateRange) ? dateRange : undefined
}

function parseMatchMode(value: ParsedJson | undefined): MatchMode {
  return value === "any" ? "any" : "all"
}

function parseTasksFiltersObject(value: ParsedJson | undefined): TasksFilters {
  if (value === undefined || !isParsedRecord(value)) {
    return cloneTasksFilters(emptyTasksFilters)
  }

  const next = cloneTasksFilters(emptyTasksFilters)
  for (const key of TASK_FILTER_ARRAY_KEYS) {
    next[key] = parseFilterItems(value[key])
  }
  next.dueDate = parseDateRange(value.dueDate)
  return next
}

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
  const data = parseJson(json)
  if (data === null || !isParsedRecord(data)) {
    return { filters: cloneTasksFilters(emptyTasksFilters), matchMode: "all" }
  }
  return {
    filters: parseTasksFiltersObject(data.filters),
    matchMode: parseMatchMode(data.matchMode),
  }
}

function isTaskListPresetId(value: string): value is TaskListPresetId {
  return TASK_LIST_PRESET_IDS.some((presetId) => presetId === value)
}

function parsePresetId(value: ParsedJson | undefined): TaskListPresetId | null {
  if (typeof value === "string" && isTaskListPresetId(value)) {
    return value
  }
  return null
}

function parseSavedViewId(value: ParsedJson | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

export function parseTaskListPageSnapshot(
  value: ParsedJson
): TaskListPageSnapshot | null {
  if (!isParsedRecord(value)) return null
  if (!("overlayFilters" in value)) return null
  return {
    activePresetId: parsePresetId(value.activePresetId),
    activeViewId: parseSavedViewId(value.activeViewId),
    overlayFilters: parseTasksFiltersObject(value.overlayFilters),
    overlayMatchMode:
      value.overlayMatchMode === "any" || value.overlayMatchMode === "all"
        ? value.overlayMatchMode
        : undefined,
    display: parseDisplaySettingsObject(value.display),
  }
}

export function serializeDisplaySettings(settings: DisplaySettings): string {
  return JSON.stringify(settings)
}

function parseDisplaySettingsObject(
  value: ParsedJson | undefined
): DisplaySettings {
  if (value === undefined || !isParsedRecord(value)) {
    return { ...defaultDisplaySettings }
  }

  const ordering = isParsedRecord(value.ordering) ? value.ordering : {}
  const field =
    typeof ordering.field === "string"
      ? ordering.field
      : ordering.field === null
        ? null
        : null

  return {
    mode: value.mode === "kanban" ? "kanban" : "list",
    grouping:
      typeof value.grouping === "string"
        ? value.grouping
        : value.grouping === null
          ? null
          : null,
    ordering: {
      field,
      direction: ordering.direction === "desc" ? "desc" : "asc",
    },
  }
}

export function parseDisplaySettingsJson(json: string): DisplaySettings {
  const data = parseJson(json)
  if (data === null) return { ...defaultDisplaySettings }
  return parseDisplaySettingsObject(data)
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
