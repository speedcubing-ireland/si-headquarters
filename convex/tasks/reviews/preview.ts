import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import {
  getTaskReviewOverride,
  getTaskReviewers,
  type TaskReviewState,
} from "@/convex/tasks/reviews/reviewState"
import type {
  ReviewPreviewOperation,
  TaskReviewerRef,
} from "@/convex/tasks/reviews/validators"
import {
  buildFlowReopenPreview,
  TaskStatusLoader,
  type TaskReopenPreview,
} from "@/convex/tasks/status/resolver"
import {
  getCurrentFlowStepIndexFromTasks,
  getProgress,
  isTerminalComplete,
  resolveFlowEffectiveStatus,
  resolveStandardEffectiveStatus,
} from "@/convex/tasks/status/rules"
import type { TaskStatus } from "@/convex/tasks/status/validators"

interface PreviewReviewer {
  approvedAt: number | null
  reviewer: TaskReviewerRef
}

interface PreviewReviewParts {
  isOverridden: boolean
  reviewers: PreviewReviewer[]
}

export async function previewReviewChangeImpact(
  ctx: QueryCtx,
  task: Doc<"tasks">,
  operation: ReviewPreviewOperation
): Promise<TaskReopenPreview> {
  const loader = new TaskStatusLoader(ctx)
  const [nextReview, subtasks] = await Promise.all([
    getPreviewReviewState(ctx, task._id, operation),
    loader.getDirectSubtasks(task._id),
  ])
  const nextStatus = resolveStatusWithReview(task, nextReview, subtasks)

  if (isTerminalComplete(nextStatus)) {
    return noFlowReopenPreview(task._id)
  }

  return await buildFlowReopenPreview(loader, task)
}

async function getPreviewReviewState(
  ctx: QueryCtx,
  taskId: Id<"tasks">,
  operation: ReviewPreviewOperation
): Promise<TaskReviewState> {
  const [reviewers, override] = await Promise.all([
    getTaskReviewers(ctx, taskId),
    getTaskReviewOverride(ctx, taskId),
  ])
  const preview = applyReviewPreview(
    {
      isOverridden: override !== null,
      reviewers,
    },
    operation
  )

  return buildPreviewReviewState(preview)
}

function applyReviewPreview(
  parts: PreviewReviewParts,
  operation: ReviewPreviewOperation
): PreviewReviewParts {
  switch (operation.type) {
    case "add-reviewer":
      return {
        ...parts,
        reviewers: hasReviewer(parts.reviewers, operation.reviewer)
          ? parts.reviewers
          : [...parts.reviewers, previewReviewer(operation.reviewer)],
      }
    case "remove-reviewer":
      return {
        ...parts,
        reviewers: parts.reviewers.filter(
          (reviewer) => !sameReviewer(reviewer.reviewer, operation.reviewer)
        ),
      }
    case "approve-reviewer":
      return {
        ...parts,
        reviewers: setPreviewApproval(
          parts.reviewers,
          operation.reviewer,
          true
        ),
      }
    case "revoke-reviewer-approval":
      return {
        ...parts,
        reviewers: setPreviewApproval(
          parts.reviewers,
          operation.reviewer,
          false
        ),
      }
    case "override-approval":
      return {
        ...parts,
        isOverridden: true,
      }
    case "remove-approval-override":
      return {
        ...parts,
        isOverridden: false,
      }
  }
}

function previewReviewer(reviewer: TaskReviewerRef): PreviewReviewer {
  return {
    reviewer,
    approvedAt: null,
  }
}

function setPreviewApproval(
  reviewers: PreviewReviewer[],
  reviewer: TaskReviewerRef,
  isApproved: boolean
): PreviewReviewer[] {
  const reviewerIndex = reviewers.findIndex((candidate) =>
    sameReviewer(candidate.reviewer, reviewer)
  )

  if (reviewerIndex === -1) throw new Error("Task reviewer not found")

  return reviewers.map((candidate, index) =>
    index === reviewerIndex
      ? {
          ...candidate,
          approvedAt: isApproved ? Date.now() : null,
        }
      : candidate
  )
}

function buildPreviewReviewState({
  isOverridden,
  reviewers,
}: PreviewReviewParts): TaskReviewState {
  const hasReviews = reviewers.length > 0

  if (isOverridden) {
    return {
      status: "approved",
      hasReviews,
      hasPendingReviews: false,
      isApproved: true,
      isOverridden: true,
      override: null,
    }
  }

  const hasPendingReviews = reviewers.some(
    (reviewer) => reviewer.approvedAt === null
  )
  const isApproved = hasReviews && !hasPendingReviews

  return {
    status: !hasReviews ? "not-required" : isApproved ? "approved" : "pending",
    hasReviews,
    hasPendingReviews,
    isApproved,
    isOverridden: false,
    override: null,
  }
}

function resolveStatusWithReview(
  task: Doc<"tasks">,
  review: TaskReviewState,
  subtasks: Doc<"tasks">[]
): TaskStatus {
  if (task.kind === "flow" && subtasks.length > 0) {
    const currentStepIndex = getCurrentFlowStepIndexFromTasks(subtasks)
    return resolveFlowEffectiveStatus({
      currentStep:
        currentStepIndex === null ? null : subtasks[currentStepIndex],
      intent: task.statusIntent,
      review,
    })
  }

  return resolveStandardEffectiveStatus({
    intent: task.statusIntent,
    progress: getProgress(subtasks.map((subtask) => subtask.status)),
    review,
  })
}

function sameReviewer(left: TaskReviewerRef, right: TaskReviewerRef) {
  return left.type === right.type && left.id === right.id
}

function hasReviewer(reviewers: PreviewReviewer[], reviewer: TaskReviewerRef) {
  return reviewers.some((candidate) =>
    sameReviewer(candidate.reviewer, reviewer)
  )
}

function noFlowReopenPreview(taskId: Id<"tasks">): TaskReopenPreview {
  return {
    willReopenFlowStep: false,
    taskId,
    flowId: null,
    reopenedStepId: null,
  }
}
