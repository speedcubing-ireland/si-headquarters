import { describe, expect, it } from "vitest"
import { matchesPointInDateRange } from "@/features/list-views/filter-engine"
import {
  emptyTasksFilters,
  shouldShowTaskMatchModeToggle,
} from "@/features/tasks/list/task-list-types"

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
