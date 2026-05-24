import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import {
  buildTaskReviewState,
  getTaskReviewOverride,
  getTaskReviewers,
  type TaskReviewParts,
  type TaskReviewState,
} from "@/convex/tasks/reviews/reviewState"
import type { ReviewPreviewOperation } from "@/convex/tasks/reviews/validators"
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

const PREVIEW_REVIEWER_ID = "preview" as Id<"taskReviewers">
const PREVIEW_OVERRIDE_ID = "preview" as Id<"taskReviewOverrides">
const PREVIEW_USER_ID = "preview" as Id<"users">

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
  const preview = applyReviewPreview({ reviewers, override }, taskId, operation)

  return buildTaskReviewState(preview)
}

function applyReviewPreview(
  parts: TaskReviewParts,
  taskId: Id<"tasks">,
  operation: ReviewPreviewOperation
): TaskReviewParts {
  switch (operation.type) {
    case "add-reviewer":
      return {
        ...parts,
        reviewers: hasReviewer(parts.reviewers, operation.reviewer)
          ? parts.reviewers
          : [...parts.reviewers, previewReviewer(taskId, operation.reviewer)],
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
        override: parts.override ?? previewOverride(taskId),
      }
    case "remove-approval-override":
      return {
        ...parts,
        override: null,
      }
  }
}

function previewReviewer(
  taskId: Id<"tasks">,
  reviewer: Doc<"taskReviewers">["reviewer"]
): Doc<"taskReviewers"> {
  return {
    _id: PREVIEW_REVIEWER_ID,
    _creationTime: Date.now(),
    taskId,
    reviewer,
    approvedAt: null,
    approvedBy: null,
  }
}

function setPreviewApproval(
  reviewers: Doc<"taskReviewers">[],
  reviewer: Doc<"taskReviewers">["reviewer"],
  isApproved: boolean
): Doc<"taskReviewers">[] {
  let matched = false

  const nextReviewers = reviewers.map((candidate) => {
    if (!sameReviewer(candidate.reviewer, reviewer)) return candidate
    matched = true

    return {
      ...candidate,
      approvedAt: isApproved ? Date.now() : null,
      approvedBy: isApproved ? PREVIEW_USER_ID : null,
    }
  })

  if (!matched) throw new Error("Task reviewer not found")
  return nextReviewers
}

function previewOverride(taskId: Id<"tasks">): Doc<"taskReviewOverrides"> {
  return {
    _id: PREVIEW_OVERRIDE_ID,
    _creationTime: Date.now(),
    taskId,
    overriddenAt: Date.now(),
    overriddenBy: PREVIEW_USER_ID,
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

function sameReviewer(
  left: Doc<"taskReviewers">["reviewer"],
  right: Doc<"taskReviewers">["reviewer"]
) {
  return left.type === right.type && left.id === right.id
}

function hasReviewer(
  reviewers: Doc<"taskReviewers">[],
  reviewer: Doc<"taskReviewers">["reviewer"]
) {
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
