import { query } from "@/convex/_generated/server"
import {
  getTaskOrThrow,
  getTaskReviewDetails,
  getTaskReviewState,
} from "@/convex/tasks/reviews/reviewState"
import { previewReviewChangeImpact } from "@/convex/tasks/reviews/preview"
import {
  reviewPreviewOperation,
  taskReviewerDetailsForTask,
  type TaskReviewerDetails,
} from "@/convex/tasks/reviews/validators"
import {
  requireTaskManageAccess,
  requireTaskReadAccess,
} from "@/convex/tasks/access"
import { toPublicUser } from "@/convex/users/queries"
import { v } from "convex/values"

export const getForTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await requireTaskReadAccess(ctx, args.taskId)
    return await getTaskReviewState(ctx, args.taskId)
  },
})

export const getDetailsForTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await requireTaskReadAccess(ctx, args.taskId)
    return await getTaskReviewDetails(ctx, args.taskId)
  },
})

export const getReviewerDetailsForTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  returns: taskReviewerDetailsForTask,
  handler: async (ctx, args) => {
    await requireTaskReadAccess(ctx, args.taskId)
    const { state, reviewers, override } = await getTaskReviewDetails(
      ctx,
      args.taskId
    )

    const [reviewerDetails, overriddenBy] = await Promise.all([
      Promise.all(
        reviewers.map(async (reviewer): Promise<TaskReviewerDetails> => {
          const reviewerObject = await ctx.db.get(
            reviewer.reviewer.type,
            reviewer.reviewer.id
          )

          return {
            _id: reviewer._id,
            reviewer: reviewer.reviewer,
            name: reviewerObject?.name ?? null,
            approved: reviewer.approvedAt !== null,
            approvedAt: reviewer.approvedAt,
          }
        })
      ),
      override ? ctx.db.get("users", override.overriddenBy) : null,
    ])

    return {
      state: {
        status: state.status,
        hasReviews: state.hasReviews,
        hasPendingReviews: state.hasPendingReviews,
        isApproved: state.isApproved,
        isOverridden: state.isOverridden,
      },
      reviewers: reviewerDetails,
      override: override
        ? {
            _id: override._id,
            overriddenAt: override.overriddenAt,
            overriddenBy: overriddenBy ? toPublicUser(overriddenBy) : null,
          }
        : null,
    }
  },
})

export const previewFlowReopenForReviewChange = query({
  args: {
    taskId: v.id("tasks"),
    operation: reviewPreviewOperation,
  },
  handler: async (ctx, args) => {
    await requireTaskManageAccess(ctx, args.taskId)
    const task = await getTaskOrThrow(ctx, args.taskId)
    return await previewReviewChangeImpact(ctx, task, args.operation)
  },
})
