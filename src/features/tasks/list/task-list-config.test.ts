import { describe, expect, it } from "vitest"
import {
  GLOBAL_TASK_LIST_CONFIG,
  getPresetSnapshot,
  mergeViewFilters,
  mergeScopeFilters,
  stripScopeFromFilters,
  taskListPageTitle,
  teamTaskListConfig,
} from "@/features/tasks/list/task-list-config"
import {
  countActiveTaskFilterChips,
  emptyTasksFilters,
} from "@/features/tasks/list/task-list-types"
import type { Id } from "@/convex/_generated/dataModel"

const userId = "user123" as Id<"users">
const teamId = "team456" as Id<"teams">

describe("task list page config", () => {
  it("defaults the main tasks page to My tasks before Active and All", () => {
    expect(GLOBAL_TASK_LIST_CONFIG.defaultPreset).toBe("my-tasks")
    expect(GLOBAL_TASK_LIST_CONFIG.presets).toEqual([
      "my-tasks",
      "active",
      "all",
    ])
  })

  it("uses Title Case page titles", () => {
    expect(GLOBAL_TASK_LIST_CONFIG.title).toBe("Tasks")
    expect(teamTaskListConfig(teamId, "Merch Team").title).toBe(
      "Merch Team Tasks"
    )
    expect(taskListPageTitle("Events Team")).toBe("Events Team Tasks")
  })

  it("orders team task presets as Active, Unassigned, then All", () => {
    const config = teamTaskListConfig(teamId, "Events")

    expect(config.defaultPreset).toBe("active")
    expect(config.presets).toEqual(["active", "unassigned", "all"])
  })
})

describe("getPresetSnapshot", () => {
  it("active excludes backlog and completed statuses", () => {
    const { filters } = getPresetSnapshot("active", userId)
    expect(filters.status).toEqual([
      {
        values: ["to-do", "in-progress", "awaiting-review"],
        isNot: false,
      },
    ])
  })

  it("my-tasks filters by assignee and active statuses", () => {
    const { filters } = getPresetSnapshot("my-tasks", userId)
    expect(filters.assignee).toEqual([{ values: [userId], isNot: false }])
    expect(filters.status[0]?.values).toContain("to-do")
  })

  it("unassigned filters assignee unassigned with active statuses", () => {
    const { filters } = getPresetSnapshot("unassigned", userId)
    expect(filters.assignee).toEqual([{ values: ["unassigned"], isNot: false }])
  })
})

describe("mergeScopeFilters", () => {
  it("forces team owner on team scope", () => {
    const merged = mergeScopeFilters(
      { type: "team", teamId },
      emptyTasksFilters
    )
    expect(merged.owner).toEqual([
      { values: [`teams:${teamId}`], isNot: false },
    ])
  })

  it("leaves filters unchanged for global scope", () => {
    const filters = {
      ...emptyTasksFilters,
      status: [{ values: ["to-do"], isNot: false }],
    }
    expect(mergeScopeFilters({ type: "global" }, filters)).toEqual(filters)
  })
})

describe("mergeViewFilters", () => {
  it("keeps hidden view filters when overlay filters use another key", () => {
    const baseline = {
      ...emptyTasksFilters,
      status: [{ values: ["to-do"], isNot: false }],
    }
    const overlay = {
      ...emptyTasksFilters,
      assignee: [{ values: [userId], isNot: false }],
    }

    expect(mergeViewFilters(baseline, overlay)).toMatchObject({
      status: baseline.status,
      assignee: overlay.assignee,
    })
  })

  it("layers overlay filters on top of matching hidden view filter keys", () => {
    const baseline = {
      ...emptyTasksFilters,
      status: [{ values: ["to-do"], isNot: false }],
    }
    const overlay = {
      ...emptyTasksFilters,
      status: [{ values: ["in-progress"], isNot: false }],
    }

    expect(mergeViewFilters(baseline, overlay).status).toEqual([
      { values: ["to-do"], isNot: false },
      { values: ["in-progress"], isNot: false },
    ])
  })

  it("keeps user-visible filter counts scoped to the overlay layer", () => {
    const baseline = {
      ...emptyTasksFilters,
      status: [{ values: ["to-do"], isNot: false }],
    }
    const overlay = {
      ...emptyTasksFilters,
      assignee: [{ values: [userId], isNot: false }],
    }

    expect(countActiveTaskFilterChips(overlay)).toBe(1)
    expect(
      countActiveTaskFilterChips(mergeViewFilters(baseline, overlay))
    ).toBe(2)
  })
})

describe("stripScopeFromFilters", () => {
  it("removes team owner filter before persisting views", () => {
    const filters = {
      ...emptyTasksFilters,
      owner: [{ values: [`teams:${teamId}`], isNot: false }],
      status: [{ values: ["to-do"], isNot: false }],
    }
    const stripped = stripScopeFromFilters({ type: "team", teamId }, filters)
    expect(stripped.owner).toEqual([])
    expect(stripped.status).toEqual(filters.status)
  })
})
