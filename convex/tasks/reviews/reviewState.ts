import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import type { TaskReviewerRef } from "@/convex/tasks/reviews/validators"

type ReviewReadCtx = QueryCtx | MutationCtx

const MAX_TASK_REVIEWERS = 100

type TaskReviewStatus = "not-required" | "pending" | "approved"

export interface TaskReviewState {
  status: TaskReviewStatus
  hasReviews: boolean
  hasPendingReviews: boolean
  isApproved: boolean
  isOverridden: boolean
  override: Doc<"taskReviewOverrides"> | null
}

export interface TaskReviewDetails {
  state: TaskReviewState
  reviewers: Doc<"taskReviewers">[]
  override: Doc<"taskReviewOverrides"> | null
}

export interface TaskReviewParts {
  reviewers: Doc<"taskReviewers">[]
  override: Doc<"taskReviewOverrides"> | null
}

export async function getTaskOrThrow(
  ctx: ReviewReadCtx,
  taskId: Id<"tasks">
): Promise<Doc<"tasks">> {
  const task = await ctx.db.get("tasks", taskId)
  if (!task) throw new Error("Task not found")

  return task
}

export async function getTaskReviewState(
  ctx: ReviewReadCtx,
  taskId: Id<"tasks">
): Promise<TaskReviewState> {
  return buildTaskReviewState(await getTaskReviewParts(ctx, taskId))
}

export async function getTaskReviewDetails(
  ctx: ReviewReadCtx,
  taskId: Id<"tasks">
): Promise<TaskReviewDetails> {
  const { reviewers, override } = await getTaskReviewParts(ctx, taskId)

  return {
    state: buildTaskReviewState({ reviewers, override }),
    reviewers,
    override,
  }
}

async function getTaskReviewParts(
  ctx: ReviewReadCtx,
  taskId: Id<"tasks">
): Promise<TaskReviewParts> {
  const [reviewers, override] = await Promise.all([
    getTaskReviewers(ctx, taskId),
    getTaskReviewOverride(ctx, taskId),
  ])
  return { reviewers, override }
}

export async function getTaskReviewers(
  ctx: ReviewReadCtx,
  taskId: Id<"tasks">
): Promise<Doc<"taskReviewers">[]> {
  const reviewers = await ctx.db
    .query("taskReviewers")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .take(MAX_TASK_REVIEWERS + 1)

  if (reviewers.length > MAX_TASK_REVIEWERS) {
    throw new Error(
      `Task has more than ${String(MAX_TASK_REVIEWERS)} reviewers`
    )
  }

  return reviewers
}

export async function getTaskReviewer(
  ctx: ReviewReadCtx,
  taskId: Id<"tasks">,
  reviewer: TaskReviewerRef
): Promise<Doc<"taskReviewers"> | null> {
  return await ctx.db
    .query("taskReviewers")
    .withIndex("by_taskId_and_reviewer_type_and_reviewer_id", (q) =>
      q
        .eq("taskId", taskId)
        .eq("reviewer.type", reviewer.type)
        .eq("reviewer.id", reviewer.id)
    )
    .unique()
}

export async function getTaskReviewOverride(
  ctx: ReviewReadCtx,
  taskId: Id<"tasks">
): Promise<Doc<"taskReviewOverrides"> | null> {
  return await ctx.db
    .query("taskReviewOverrides")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .unique()
}

export function buildTaskReviewState({
  reviewers,
  override,
}: TaskReviewParts): TaskReviewState {
  const hasReviews = reviewers.length > 0

  if (override) {
    return {
      status: "approved",
      hasReviews,
      hasPendingReviews: false,
      isApproved: true,
      isOverridden: true,
      override,
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
