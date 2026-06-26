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
  owner: TaskRowFilterInput["owner"] = null,
  pendingReviewerTeams: TaskRowFilterInput["pendingReviewerTeams"] = []
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
    dependencyStatuses: [],
    pendingReviewerTeams,
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

describe("pendingTeamApproval filter", () => {
  const teamA = { _id: "teamA" as never, name: "Events" }
  const teamB = { _id: "teamB" as never, name: "Tech" }

  const rowWithTeams = (teams: (typeof teamA)[]) =>
    row("to-do", "standard", null, null, teams)

  const pendingRows = [
    rowWithTeams([teamA]),
    rowWithTeams([teamB]),
    rowWithTeams([teamA, teamB]),
    rowWithTeams([]),
  ]

  it("matches rows where the selected team has an outstanding approval", () => {
    const filters = {
      ...emptyTasksFilters,
      pendingTeamApproval: [{ values: ["teamA"], isNot: false }],
    }
    expect(filterTaskRows(pendingRows, filters, "all")).toEqual([
      pendingRows[0],
      pendingRows[2],
    ])
  })

  it("supports isNot to exclude rows where the team has an outstanding approval", () => {
    const filters = {
      ...emptyTasksFilters,
      pendingTeamApproval: [{ values: ["teamA"], isNot: true }],
    }
    expect(filterTaskRows(pendingRows, filters, "all")).toEqual([
      pendingRows[1],
      pendingRows[3],
    ])
  })

  it("returns no rows when no task has a pending approval for any of the selected teams", () => {
    const filters = {
      ...emptyTasksFilters,
      pendingTeamApproval: [{ values: ["teamC"], isNot: false }],
    }
    expect(filterTaskRows(pendingRows, filters, "all")).toHaveLength(0)
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
