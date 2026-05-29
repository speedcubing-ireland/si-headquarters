import type { DisplaySettings } from "@/features/list-views/types"

export function compareStrings(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: "asc" | "desc" = "asc"
) {
  const a = left ?? ""
  const b = right ?? ""
  const result = a.localeCompare(b, undefined, { sensitivity: "base" })
  return direction === "asc" ? result : -result
}

export function createRowSorter<TRow>(
  comparators: Record<string, (left: TRow, right: TRow) => number>
) {
  return function sortRows(rows: TRow[], display: DisplaySettings): TRow[] {
    const field = display.ordering.field
    if (field === null) return rows

    if (!(field in comparators)) return rows
    const compare = comparators[field]

    const direction = display.ordering.direction
    return [...rows].sort((left, right) => {
      const result = compare(left, right)
      return direction === "desc" ? -result : result
    })
  }
}
