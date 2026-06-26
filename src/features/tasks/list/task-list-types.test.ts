import { describe, expect, it } from "vitest"
import {
  countActiveTaskFilterChips,
  countVisibleTaskFilterChips,
  emptyTasksFilters,
  shouldShowTaskMatchModeToggle,
  type TaskFilterKey,
  type TasksFilters,
} from "@/features/tasks/list/task-list-types"
import type { Id } from "@/convex/_generated/dataModel"

const teamId = "team456" as Id<"teams">
const userId = "user123" as Id<"users">

const TEAM_HIDDEN_KEYS: readonly TaskFilterKey[] = ["owner"]
const NO_HIDDEN_KEYS: readonly TaskFilterKey[] = []

function filters(overrides: Partial<TasksFilters>): TasksFilters {
  return { ...emptyTasksFilters, ...overrides }
}

describe("countVisibleTaskFilterChips", () => {
  it("counts every array chip and the due-date chip when nothing is hidden", () => {
    const value = filters({
      status: [{ values: ["to-do"], isNot: false }],
      assignee: [{ values: [userId], isNot: false }],
      dueDate: { start: "2026-01-01", end: "2026-12-31", isNot: false },
    })

    expect(countVisibleTaskFilterChips(value, NO_HIDDEN_KEYS)).toBe(3)
  })

  it("skips chips whose key is hidden for the current scope", () => {
    const value = filters({
      owner: [{ values: [`teams:${teamId}`], isNot: false }],
      status: [{ values: ["to-do"], isNot: false }],
    })

    // The forced team owner filter must not surface as a chip.
    expect(countVisibleTaskFilterChips(value, TEAM_HIDDEN_KEYS)).toBe(1)
    expect(countVisibleTaskFilterChips(value, NO_HIDDEN_KEYS)).toBe(2)
  })

  it("counts multiple chips on the same key", () => {
    const value = filters({
      status: [
        { values: ["to-do"], isNot: false },
        { values: ["in-progress"], isNot: true },
      ],
    })

    expect(countVisibleTaskFilterChips(value, NO_HIDDEN_KEYS)).toBe(2)
  })

  it("ignores an empty due-date range", () => {
    const value = filters({
      dueDate: { isNot: false },
    })

    expect(countVisibleTaskFilterChips(value, NO_HIDDEN_KEYS)).toBe(0)
  })

  it("returns zero for empty filters", () => {
    expect(countVisibleTaskFilterChips(emptyTasksFilters, NO_HIDDEN_KEYS)).toBe(
      0
    )
  })

  it("matches the unscoped chip count when no keys are hidden", () => {
    const value = filters({
      status: [{ values: ["to-do"], isNot: false }],
      owner: [{ values: [`teams:${teamId}`], isNot: false }],
      dueDate: { start: "2026-01-01", isNot: false },
    })

    expect(countVisibleTaskFilterChips(value, NO_HIDDEN_KEYS)).toBe(
      countActiveTaskFilterChips(value)
    )
  })
})

describe("shouldShowTaskMatchModeToggle", () => {
  it("hides the toggle with a single active filter type", () => {
    const value = filters({
      status: [
        { values: ["to-do"], isNot: false },
        { values: ["in-progress"], isNot: false },
      ],
    })

    // Two chips, but only one filter *type* — the toggle stays hidden.
    expect(countActiveTaskFilterChips(value)).toBe(2)
    expect(shouldShowTaskMatchModeToggle(value)).toBe(false)
  })

  it("shows the toggle once two filter types are active", () => {
    const value = filters({
      status: [{ values: ["to-do"], isNot: false }],
      assignee: [{ values: [userId], isNot: false }],
    })

    expect(shouldShowTaskMatchModeToggle(value)).toBe(true)
  })

  it("counts a due-date filter as its own type", () => {
    const value = filters({
      status: [{ values: ["to-do"], isNot: false }],
      dueDate: { start: "2026-01-01", isNot: false },
    })

    expect(shouldShowTaskMatchModeToggle(value)).toBe(true)
  })
})
