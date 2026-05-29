import { describe, expect, it } from "vitest"
import { matchesPointInDateRange } from "@/features/list-views/filter-engine"
import { filterTaskRows } from "@/features/tasks/list/task-filters"
import {
  emptyTasksFilters,
  shouldShowTaskMatchModeToggle,
} from "@/features/tasks/list/task-list-types"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"

function row(
  status: TaskBoardRow["statusView"]["effectiveStatus"],
  kind: TaskBoardRow["task"]["kind"],
  dueDate: string | null
): TaskBoardRow {
  return {
    statusView: { effectiveStatus: status },
    task: { kind, dueDate },
  } as unknown as TaskBoardRow
}

const rows = [
  row("to-do", "standard", "2026-06-10"),
  row("done", "flow", "2026-07-01"),
  row("to-do", "flow", "2026-06-20"),
]

describe("matchesPointInDateRange", () => {
  it("supports isNot", () => {
    expect(
      matchesPointInDateRange("2026-06-15", {
        start: "2026-06-01",
        end: "2026-06-30",
        isNot: true,
      })
    ).toBe(false)
  })
})

describe("filterTaskRows match mode", () => {
  const baseFilters = {
    ...emptyTasksFilters,
    status: [{ values: ["to-do"], isNot: false }],
    kind: [{ values: ["flow"], isNot: false }],
  }

  it("match all requires every filter type", () => {
    expect(filterTaskRows(rows, baseFilters, "all")).toHaveLength(1)
  })

  it("match any matches if any filter type matches", () => {
    expect(filterTaskRows(rows, baseFilters, "any")).toHaveLength(3)
  })
})

describe("shouldShowTaskMatchModeToggle", () => {
  it("hides toggle with a single filter clause", () => {
    expect(
      shouldShowTaskMatchModeToggle({
        ...emptyTasksFilters,
        status: [{ values: ["to-do"], isNot: false }],
      })
    ).toBe(false)
  })

  it("shows toggle with two filter types", () => {
    expect(
      shouldShowTaskMatchModeToggle({
        ...emptyTasksFilters,
        status: [{ values: ["to-do"], isNot: false }],
        kind: [{ values: ["flow"], isNot: false }],
      })
    ).toBe(true)
  })

  it("counts due date as a matcher", () => {
    expect(
      shouldShowTaskMatchModeToggle({
        ...emptyTasksFilters,
        phase: [{ values: ["phase-1"], isNot: false }],
        dueDate: { start: "2026-01-01" },
      })
    ).toBe(true)
  })
})
