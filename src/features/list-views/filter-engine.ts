import type { DateRangeFilter, FilterItem, MatchMode } from "@/features/list-views/types"

export function matchesFilterItems(
  filterItems: FilterItem[],
  rowValues: string[],
  matchMode: MatchMode
): boolean {
  if (filterItems.length === 0) return true

  const matchesValues = (values: string[]) =>
    rowValues.some((value) => values.includes(value))

  const positive = filterItems.filter((item) => !item.isNot)
  const negative = filterItems.filter((item) => item.isNot)

  const positiveMatch =
    positive.length === 0
      ? true
      : matchMode === "all"
        ? positive.every((item) => matchesValues(item.values))
        : positive.some((item) => matchesValues(item.values))

  const negativeMatch = negative.every((item) => !matchesValues(item.values))

  return positiveMatch && negativeMatch
}

export function matchesPointInDateRange(
  isoDate: string | null | undefined,
  dateRange: DateRangeFilter
): boolean {
  if (!isoDate) return false

  const point = new Date(isoDate)
  const start =
    dateRange.start !== undefined ? new Date(dateRange.start) : null
  const end = dateRange.end !== undefined ? new Date(dateRange.end) : null

  const inRange =
    (start === null || point >= start) && (end === null || point <= end)

  return dateRange.isNot === true ? !inRange : inRange
}
