import { describe, expect, it } from "vitest"
import {
  filterTaskRowsForListPage,
  filterTaskRows,
  type TaskRowFilterInput,
} from "@/features/tasks/list/task-filters"
import { emptyTasksFilters } from "@/features/tasks/list/task-list-types"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"

function row(
  status: TaskBoardRow["statusView"]["effectiveStatus"],
  kind: TaskBoardRow["task"]["kind"],
  dueDate: string | null,
  owner: TaskRowFilterInput["owner"] = null
): TaskRowFilterInput {
  return {
    statusView: { effectiveStatus: status },
    task: { kind, dueDate },
    assignees: {
      mode: "none",
      userIds: [],
      users: [],
      primaryUser: null,
    },
    owner,
    labels: [],
    competitionId: null,
    phaseId: null,
  } as unknown as TaskRowFilterInput
}

const rows = [
  row("to-do", "standard", "2026-06-10"),
  row("done", "flow", "2026-07-01"),
  row("to-do", "flow", "2026-06-20"),
]

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

describe("filterTaskRowsForListPage", () => {
  it("applies overlay filters as a separate layer on top of hidden view filters", () => {
    const viewFilters = {
      ...emptyTasksFilters,
      status: [{ values: ["to-do"], isNot: false }],
      kind: [{ values: ["flow"], isNot: false }],
    }
    const overlayFilters = {
      ...emptyTasksFilters,
      status: [{ values: ["done"], isNot: false }],
    }

    expect(
      filterTaskRowsForListPage({
        rows,
        scope: { type: "global" },
        viewFilters,
        viewMatchMode: "any",
        overlayFilters,
        overlayMatchMode: "all",
      })
    ).toEqual([rows[1]])
  })

  it("does not let an empty overlay match mode change hidden view filtering", () => {
    const viewFilters = {
      ...emptyTasksFilters,
      status: [{ values: ["to-do"], isNot: false }],
      kind: [{ values: ["flow"], isNot: false }],
    }

    expect(
      filterTaskRowsForListPage({
        rows,
        scope: { type: "global" },
        viewFilters,
        viewMatchMode: "any",
        overlayFilters: emptyTasksFilters,
        overlayMatchMode: "all",
      })
    ).toEqual(rows)
  })

  it("applies team scope without requiring the overlay to know about owner filters", () => {
    const teamId = "team123"
    const teamRows = [
      row("to-do", "standard", null, {
        type: "teams",
        _id: teamId,
        name: "Events",
      } as TaskRowFilterInput["owner"]),
      row("to-do", "standard", null, {
        type: "teams",
        _id: "other-team",
        name: "Other",
      } as TaskRowFilterInput["owner"]),
    ]

    expect(
      filterTaskRowsForListPage({
        rows: teamRows,
        scope: { type: "team", teamId: teamId as never },
        viewFilters: emptyTasksFilters,
        viewMatchMode: "all",
        overlayFilters: emptyTasksFilters,
        overlayMatchMode: "all",
      })
    ).toEqual([teamRows[0]])
  })
})
