import { query } from "@/convex/_generated/server"
import {
  getTaskOrThrow,
  getTaskReviewDetails,
  getTaskReviewState,
} from "@/convex/tasks/reviews/reviewState"
import { previewReviewChangeImpact } from "@/convex/tasks/reviews/preview"
import {
  potentialTaskReviewers,
  reviewPreviewOperation,
  taskReviewerDetailsForTask,
  type TaskReviewerDetails,
} from "@/convex/tasks/reviews/validators"
import { toPublicUser } from "@/convex/users/queries"
import { requireCan, requirePrincipal } from "@/convex/permissions/principal"
import { v } from "convex/values"

const MAX_POTENTIAL_REVIEWER_OPTIONS = 100

export const getForTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    return await getTaskReviewState(ctx, args.taskId)
  },
})

export const getDetailsForTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    return await getTaskReviewDetails(ctx, args.taskId)
  },
})

export const getReviewerDetailsForTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  returns: taskReviewerDetailsForTask,
  handler: async (ctx, args) => {
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

export const listPotentialReviewers = query({
  args: {},
  returns: potentialTaskReviewers,
  handler: async (ctx) => {
    const principal = await requirePrincipal(ctx)
    requireCan(principal, "manage", "Task")

    const [teams, users] = await Promise.all([
      ctx.db.query("teams").take(MAX_POTENTIAL_REVIEWER_OPTIONS),
      ctx.db.query("users").take(MAX_POTENTIAL_REVIEWER_OPTIONS),
    ])

    return {
      teams: teams.map((team) => ({
        _id: team._id,
        name: team.name,
      })),
      users: users.map(toPublicUser),
    }
  },
})

export const previewFlowReopenForReviewChange = query({
  args: {
    taskId: v.id("tasks"),
    operation: reviewPreviewOperation,
  },
  handler: async (ctx, args) => {
    const task = await getTaskOrThrow(ctx, args.taskId)
    return await previewReviewChangeImpact(ctx, task, args.operation)
  },
})
