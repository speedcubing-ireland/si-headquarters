export type MatchMode = "any" | "all"

export interface FilterItem {
  values: string[]
  isNot: boolean
}

export interface DateRangeFilter {
  start?: string
  end?: string
  isNot?: boolean
}

export function hasDateRangeValue(dateRange?: DateRangeFilter): boolean {
  return (
    dateRange !== undefined &&
    (dateRange.start !== undefined || dateRange.end !== undefined)
  )
}

export type DisplayMode = "list" | "kanban"

export interface DisplaySettings {
  mode: DisplayMode
  grouping: string | null
  ordering: { field: string | null; direction: "asc" | "desc" }
}

export const defaultDisplaySettings: DisplaySettings = {
  mode: "list",
  grouping: null,
  ordering: { field: null, direction: "asc" },
}
