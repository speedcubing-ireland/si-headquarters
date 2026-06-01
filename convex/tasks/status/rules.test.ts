import { describe, expect, test } from "vitest"
import type { TaskReviewState } from "@/convex/tasks/reviews/reviewState"
import {
  assertStandardStatusCommand,
  autoStatusIntent,
  getCompletionStatus,
  getCurrentFlowStepIndexFromStatuses,
  getFlowChildState,
  getFlowParentStatusOptions,
  getProgress,
  isTerminalComplete,
  toPhaseProgressBuckets,
  manualIntent,
  resolveStandardEffectiveStatus,
  statusIntentEquals,
} from "./rules"

function reviewState(status: TaskReviewState["status"]): TaskReviewState {
  const hasReviews = status !== "not-required"
  const hasPendingReviews = status === "pending"

  return {
    status,
    hasReviews,
    hasPendingReviews,
    isApproved: status === "approved",
    isOverridden: false,
    override: null,
  }
}

describe("task status rules", () => {
  test("done and cancelled are the only complete statuses", () => {
    expect(isTerminalComplete("done")).toBe(true)
    expect(isTerminalComplete("cancelled")).toBe(true)
    expect(isTerminalComplete("awaiting-review")).toBe(false)
    expect(isTerminalComplete("in-progress")).toBe(false)
  })

  test("progress treats cancelled children as complete but not done", () => {
    expect(getProgress(["done", "cancelled", "awaiting-review"])).toEqual({
      total: 3,
      terminalComplete: 2,
      done: 1,
      cancelled: 1,
      incomplete: 1,
      percent: 67,
    })
  })

  test("phase progress buckets split incomplete tasks into blocked and in progress", () => {
    expect(
      toPhaseProgressBuckets(
        {
          total: 4,
          terminalComplete: 2,
          done: 2,
          cancelled: 0,
          incomplete: 2,
          percent: 50,
        },
        1
      )
    ).toEqual({
      total: 4,
      done: 2,
      cancelled: 0,
      incomplete: 2,
      inProgress: 1,
      blocked: 1,
      completionPercent: 50,
    })
  })

  test("review gate completes to awaiting-review only while reviews are pending", () => {
    expect(getCompletionStatus(reviewState("pending"))).toBe("awaiting-review")
    expect(getCompletionStatus(reviewState("approved"))).toBe("done")
    expect(getCompletionStatus(reviewState("not-required"))).toBe("done")
  })

  test("standard terminal intent is blocked by incomplete subtasks", () => {
    const progress = getProgress(["to-do"])
    const review = reviewState("approved")

    expect(
      resolveStandardEffectiveStatus({
        intent: manualIntent("done"),
        progress,
        review,
      })
    ).toBe("in-progress")
    expect(() => {
      assertStandardStatusCommand("done", review, progress)
    }).toThrow("incomplete subtasks")
  })

  test("standard done command is rejected while reviews are pending", () => {
    const progress = getProgress([])
    const review = reviewState("pending")

    expect(() => {
      assertStandardStatusCommand("done", review, progress)
    }).toThrow("pending reviews")
    expect(() => {
      assertStandardStatusCommand("awaiting-review", review, progress)
    }).not.toThrow()
  })

  test("standard awaiting-review command is rejected without pending reviews", () => {
    expect(() => {
      assertStandardStatusCommand(
        "awaiting-review",
        reviewState("not-required"),
        getProgress([])
      )
    }).toThrow("without pending reviews")
  })

  test("standard completion resolves through the current review state", () => {
    const progress = getProgress([])

    expect(
      resolveStandardEffectiveStatus({
        intent: manualIntent("done"),
        progress,
        review: reviewState("pending"),
      })
    ).toBe("awaiting-review")
    expect(
      resolveStandardEffectiveStatus({
        intent: manualIntent("awaiting-review"),
        progress,
        review: reviewState("approved"),
      })
    ).toBe("done")
  })

  test("flow current step is the earliest incomplete status by order", () => {
    expect(
      getCurrentFlowStepIndexFromStatuses(["done", "cancelled"])
    ).toBeNull()
    expect(
      getCurrentFlowStepIndexFromStatuses(["done", "awaiting-review", "to-do"])
    ).toBe(1)
  })

  test("flow child position locks past and future steps", () => {
    expect(
      getFlowChildState({ status: "done", index: 0, currentIndex: 1 })
    ).toBe("complete")
    expect(
      getFlowChildState({ status: "to-do", index: 1, currentIndex: 1 })
    ).toBe("current")
    expect(
      getFlowChildState({ status: "done", index: 2, currentIndex: 1 })
    ).toBe("future")
  })

  test("flow parent never exposes backlog after all steps complete", () => {
    expect(getFlowParentStatusOptions({ currentStepId: null })).toEqual([
      "auto",
      "cancelled",
    ])
  })

  test("status intent equality compares discriminated values", () => {
    expect(statusIntentEquals(autoStatusIntent(), autoStatusIntent())).toBe(
      true
    )
    expect(statusIntentEquals(manualIntent("done"), manualIntent("done"))).toBe(
      true
    )
    expect(
      statusIntentEquals(manualIntent("done"), manualIntent("cancelled"))
    ).toBe(false)
  })
})
