import { describe, expect, test } from "vitest"
import { deriveDependencyStatuses } from "./dependency"

describe("deriveDependencyStatuses", () => {
  test("returns no-dependencies when task has no blocker relationships", () => {
    expect(
      deriveDependencyStatuses({ openCount: 0, blockingCount: 0 }, "to-do")
    ).toEqual(["no-dependencies"])
  })

  test("returns blocked when task has open incoming blockers", () => {
    expect(
      deriveDependencyStatuses({ openCount: 1, blockingCount: 0 }, "to-do")
    ).toEqual(["blocked"])
  })

  test("returns blocking when open task has outgoing blocker edges", () => {
    expect(
      deriveDependencyStatuses(
        { openCount: 0, blockingCount: 1 },
        "in-progress"
      )
    ).toEqual(["blocking"])
  })

  test("returns both blocked and blocking when task is simultaneously blocking others and blocked itself", () => {
    expect(
      deriveDependencyStatuses({ openCount: 2, blockingCount: 3 }, "to-do")
    ).toEqual(["blocked", "blocking"])
  })

  test("returns no-dependencies when all incoming blockers are resolved (openCount is 0)", () => {
    expect(
      deriveDependencyStatuses(
        { openCount: 0, blockingCount: 0 },
        "in-progress"
      )
    ).toEqual(["no-dependencies"])
  })

  test("returns no-dependencies for a terminal-complete task even if it has outgoing blocker edges", () => {
    expect(
      deriveDependencyStatuses({ openCount: 0, blockingCount: 2 }, "done")
    ).toEqual(["no-dependencies"])
  })

  test("returns no-dependencies for a cancelled task even if it has outgoing blocker edges", () => {
    expect(
      deriveDependencyStatuses({ openCount: 0, blockingCount: 1 }, "cancelled")
    ).toEqual(["no-dependencies"])
  })

  test("a completed task that is also blocked returns only blocked (not blocking)", () => {
    expect(
      deriveDependencyStatuses({ openCount: 1, blockingCount: 1 }, "done")
    ).toEqual(["blocked"])
  })
})
