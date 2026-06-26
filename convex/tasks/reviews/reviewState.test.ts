import { describe, expect, it } from "vitest"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import {
  buildTaskReviewState,
  pendingReviewerTeamIds,
  type TaskReviewParts,
} from "@/convex/tasks/reviews/reviewState"

function makeParts(
  reviewers: Pick<
    Doc<"taskReviewers">,
    "reviewer" | "approvedAt" | "approvedBy"
  >[],
  override: Doc<"taskReviewOverrides"> | null = null
): TaskReviewParts {
  const taskId = "fakeTaskId" as Id<"tasks">
  return {
    reviewers: reviewers.map((r, i) => ({
      ...r,
      _id: `rev${String(i)}` as Id<"taskReviewers">,
      _creationTime: 0,
      taskId,
    })),
    override: override
      ? {
          ...override,
          _id: "fakeOverrideId" as Id<"taskReviewOverrides">,
          _creationTime: 0,
          taskId,
        }
      : null,
  }
}

const teamId = "teamAbc" as Id<"teams">
const userId = "userXyz" as Id<"users">

describe("pendingReviewerTeamIds", () => {
  it("returns the id of a team reviewer with an outstanding approval", () => {
    const parts = makeParts([
      {
        reviewer: { type: "teams", id: teamId },
        approvedAt: null,
        approvedBy: null,
      },
    ])
    expect(pendingReviewerTeamIds(parts)).toEqual([teamId])
  })

  it("excludes a team reviewer that has already approved", () => {
    const parts = makeParts([
      {
        reviewer: { type: "teams", id: teamId },
        approvedAt: Date.now(),
        approvedBy: userId,
      },
    ])
    expect(pendingReviewerTeamIds(parts)).toEqual([])
  })

  it("excludes user reviewers even when pending", () => {
    const parts = makeParts([
      {
        reviewer: { type: "users", id: userId },
        approvedAt: null,
        approvedBy: null,
      },
    ])
    expect(pendingReviewerTeamIds(parts)).toEqual([])
  })

  it("returns empty when there are no reviewers", () => {
    expect(pendingReviewerTeamIds(makeParts([]))).toEqual([])
  })

  it("returns empty when an override is present even if team reviewers are pending", () => {
    const parts = makeParts(
      [
        {
          reviewer: { type: "teams", id: teamId },
          approvedAt: null,
          approvedBy: null,
        },
      ],
      {
        taskId: "fakeTaskId" as Id<"tasks">,
        overriddenAt: Date.now(),
        overriddenBy: userId,
      } as unknown as Doc<"taskReviewOverrides">
    )
    // buildTaskReviewState marks hasPendingReviews=false when overridden
    expect(buildTaskReviewState(parts).hasPendingReviews).toBe(false)
    expect(pendingReviewerTeamIds(parts)).toEqual([])
  })

  it("returns multiple team ids when multiple teams have outstanding approvals", () => {
    const teamId2 = "teamDef" as Id<"teams">
    const parts = makeParts([
      {
        reviewer: { type: "teams", id: teamId },
        approvedAt: null,
        approvedBy: null,
      },
      {
        reviewer: { type: "teams", id: teamId2 },
        approvedAt: null,
        approvedBy: null,
      },
    ])
    expect(pendingReviewerTeamIds(parts)).toEqual([teamId, teamId2])
  })

  it("only returns teams that are still pending when some have approved", () => {
    const teamId2 = "teamDef" as Id<"teams">
    const parts = makeParts([
      {
        reviewer: { type: "teams", id: teamId },
        approvedAt: Date.now(),
        approvedBy: userId,
      },
      {
        reviewer: { type: "teams", id: teamId2 },
        approvedAt: null,
        approvedBy: null,
      },
    ])
    expect(pendingReviewerTeamIds(parts)).toEqual([teamId2])
  })
})
