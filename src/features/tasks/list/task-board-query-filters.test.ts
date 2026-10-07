import { describe, expect, test } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import { taskBoardQueryFilters } from "@/features/tasks/list/task-board-query-filters"
import { emptyTasksFilters } from "@/features/tasks/list/task-list-types"

const userId = "viewer" as Id<"users">

describe("task board query narrowing", () => {
  test("My Tasks can narrow both assignment and status before hydration", () => {
    expect(
      taskBoardQueryFilters(
        {
          ...emptyTasksFilters,
          assignee: [{ values: [userId], isNot: false }],
          status: [
            {
              values: ["to-do", "in-progress", "awaiting-review"],
              isNot: false,
            },
          ],
        },
        "all",
        userId
      )
    ).toEqual({
      assignedToMe: true,
      effectiveStatuses: ["to-do", "in-progress", "awaiting-review"],
    })
  })
  test("OR views must retain rows matching other fields", () => {
    expect(
      taskBoardQueryFilters(
        {
          ...emptyTasksFilters,
          assignee: [{ values: [userId], isNot: false }],
          status: [{ values: ["done"], isNot: false }],
        },
        "any",
        userId
      )
    ).toEqual({})
  })
  test("multiple assignees and negated assignee filters cannot narrow to the viewer", () => {
    for (const assignee of [
      [{ values: [userId, "another-user"], isNot: false }],
      [{ values: [userId], isNot: true }],
    ]) {
      expect(
        taskBoardQueryFilters({ ...emptyTasksFilters, assignee }, "all", userId)
      ).toEqual({})
    }
  })
  test("status constraints intersect positives and subtract negations", () => {
    expect(
      taskBoardQueryFilters(
        {
          ...emptyTasksFilters,
          status: [
            { values: ["to-do", "done"], isNot: false },
            { values: ["done"], isNot: true },
          ],
        },
        "all",
        userId
      )
    ).toEqual({ effectiveStatuses: ["to-do"] })
  })
  test("contradictory statuses load no rows and unconstrained views load all rows", () => {
    expect(
      taskBoardQueryFilters(
        {
          ...emptyTasksFilters,
          status: [
            { values: ["to-do"], isNot: false },
            { values: ["done"], isNot: false },
          ],
        },
        "all",
        userId
      )
    ).toEqual({ effectiveStatuses: [] })
    expect(taskBoardQueryFilters(emptyTasksFilters, "all", userId)).toEqual({})
  })
})
