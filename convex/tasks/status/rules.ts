import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { TaskReviewState } from "@/convex/tasks/reviews/reviewState"
import type {
  TaskStatus,
  TaskStatusCommand,
  TaskStatusIntent,
} from "@/convex/tasks/status/validators"

export type {
  TaskStatus,
  TaskStatusCommand,
  TaskStatusIntent,
} from "@/convex/tasks/status/validators"

export interface TaskProgress {
  total: number
  terminalComplete: number
  done: number
  cancelled: number
  incomplete: number
  percent: number
}

export type FlowStepState = "current" | "future" | "complete"

const TERMINAL_COMPLETE_STATUSES = new Set<TaskStatus>(["done", "cancelled"])
const OPEN_STATUS_OPTIONS: TaskStatusCommand[] = [
  "backlog",
  "to-do",
  "in-progress",
  "cancelled",
]

export function manualIntent(status: TaskStatus): TaskStatusIntent {
  return { type: "manual", status }
}

export function autoStatusIntent(): TaskStatusIntent {
  return { type: "auto" }
}

export function statusIntentEquals(
  left: TaskStatusIntent,
  right: TaskStatusIntent
) {
  if (left.type !== right.type) return false
  if (left.type === "auto") return true
  return right.type === "manual" && left.status === right.status
}

export function getIntentStatus(intent: TaskStatusIntent): TaskStatus | null {
  return intent.type === "manual" ? intent.status : null
}

export function isBacklogIntent(intent: TaskStatusIntent): boolean {
  return intent.type === "manual" && intent.status === "backlog"
}

export function isTerminalComplete(status: TaskStatus): boolean {
  return TERMINAL_COMPLETE_STATUSES.has(status)
}

export function isReviewTerminalStatus(status: TaskStatus): boolean {
  return status === "done" || status === "awaiting-review"
}

export function getProgress(statuses: TaskStatus[]): TaskProgress {
  const total = statuses.length
  let done = 0
  let cancelled = 0

  for (const status of statuses) {
    if (status === "done") done += 1
    if (status === "cancelled") cancelled += 1
  }

  const terminalComplete = done + cancelled
  const incomplete = total - terminalComplete
  const percent = total === 0 ? 100 : Math.round((terminalComplete / total) * 100)

  return {
    total,
    terminalComplete,
    done,
    cancelled,
    incomplete,
    percent,
  }
}

export function getCompletionStatus(review: TaskReviewState): TaskStatus {
  return review.hasPendingReviews ? "awaiting-review" : "done"
}

export function resolveStandardEffectiveStatus({
  intent,
  progress,
  review,
}: {
  intent: TaskStatusIntent
  progress: TaskProgress
  review: TaskReviewState
}): TaskStatus {
  const status = getIntentStatus(intent) ?? "to-do"
  if (status === "cancelled") return "cancelled"
  if (!isReviewTerminalStatus(status)) return status
  if (progress.incomplete > 0) return "in-progress"
  return getCompletionStatus(review)
}

export function getStandardStatusOptions({
  progress,
  review,
}: {
  progress: TaskProgress
  review: TaskReviewState
}): TaskStatusCommand[] {
  if (progress.incomplete > 0) return [...OPEN_STATUS_OPTIONS]
  return [...OPEN_STATUS_OPTIONS, getCompletionStatus(review)]
}

export function assertStandardStatusCommand(
  requestedStatus: TaskStatus,
  review: TaskReviewState,
  progress: TaskProgress
) {
  if (
    getStandardStatusOptions({ review, progress }).includes(requestedStatus)
  ) {
    return
  }

  if (progress.incomplete > 0 && isReviewTerminalStatus(requestedStatus)) {
    throw new Error(
      "Tasks with incomplete subtasks cannot be marked done or awaiting review"
    )
  }
  if (requestedStatus === "done" && review.hasPendingReviews) {
    throw new Error("Tasks with pending reviews cannot be marked done")
  }
  if (requestedStatus === "awaiting-review" && !review.hasPendingReviews) {
    throw new Error("Tasks without pending reviews cannot await review")
  }

  throw new Error(`Task status ${requestedStatus} is not available`)
}

export function getCurrentFlowStepIndexFromStatuses(
  statuses: TaskStatus[]
): number | null {
  const index = statuses.findIndex((status) => !isTerminalComplete(status))
  return index === -1 ? null : index
}

export function getCurrentFlowStepIndexFromTasks(
  tasks: Doc<"tasks">[]
): number | null {
  return getCurrentFlowStepIndexFromStatuses(tasks.map((task) => task.status))
}

export function resolveFlowEffectiveStatus({
  currentStep,
  intent,
  review,
}: {
  currentStep: Doc<"tasks"> | null
  intent: TaskStatusIntent
  review: TaskReviewState
}): TaskStatus {
  if (intent.type === "manual" && intent.status === "cancelled") {
    return "cancelled"
  }
  if (currentStep === null) return getCompletionStatus(review)
  if (intent.type === "manual" && intent.status === "backlog") {
    return "backlog"
  }

  return currentStep.status
}

export function getFlowParentStatusOptions({
  currentStepId,
}: {
  currentStepId: Id<"tasks"> | null
}): TaskStatusCommand[] {
  if (currentStepId === null) return ["auto", "cancelled"]
  return ["backlog", "auto", "cancelled"]
}

export function getFlowChildState({
  index,
  currentIndex,
  status,
}: {
  index: number
  currentIndex: number | null
  status: TaskStatus
}): FlowStepState {
  if (currentIndex !== null && index > currentIndex) return "future"
  if (isTerminalComplete(status)) return "complete"
  if (currentIndex === null) return "future"
  return "current"
}
