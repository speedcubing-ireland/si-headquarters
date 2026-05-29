import { describe, expect, it } from "vitest"
import {
  filterTaskRows,
  type TaskRowFilterInput,
} from "@/features/tasks/list/task-filters"
import { emptyTasksFilters } from "@/features/tasks/list/task-list-types"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"

function row(
  status: TaskBoardRow["statusView"]["effectiveStatus"],
  kind: TaskBoardRow["task"]["kind"],
  dueDate: string | null
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
    owner: null,
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
