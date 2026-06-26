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

export function reviewerMatchesPrincipal(
  reviewer: TaskReviewerRef,
  userId: Id<"users">,
  teamIds: ReadonlySet<Id<"teams">>
): boolean {
  if (reviewer.type === "users") return reviewer.id === userId
  return teamIds.has(reviewer.id)
}

export function pendingReviewTaskIdsForPrincipal(
  reviewers: Doc<"taskReviewers">[],
  userId: Id<"users">,
  teamIds: ReadonlySet<Id<"teams">>
): Set<Id<"tasks">> {
  const taskIds = new Set<Id<"tasks">>()
  for (const row of reviewers) {
    if (row.approvedAt !== null) continue
    if (!reviewerMatchesPrincipal(row.reviewer, userId, teamIds)) continue
    taskIds.add(row.taskId)
  }
  return taskIds
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

export function pendingReviewerTeamIds(parts: TaskReviewParts): Id<"teams">[] {
  if (!buildTaskReviewState(parts).hasPendingReviews) return []
  const ids: Id<"teams">[] = []
  for (const row of parts.reviewers) {
    if (row.approvedAt !== null) continue
    if (row.reviewer.type !== "teams") continue
    ids.push(row.reviewer.id)
  }
  return ids
}

export async function getTaskReviewParts(
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
