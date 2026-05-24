import { mutation } from "@/convex/_generated/server"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  getTaskReviewer,
  getTaskReviewOverride,
} from "@/convex/tasks/reviews/reviewState"
import { taskReviewerRef } from "@/convex/tasks/reviews/validators"
import { recomputeRelatedTaskStatuses } from "@/convex/tasks/status/recompute"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

async function getRequiredAuthUserId(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error("Authentication required")

  return userId as Id<"users">
}

export const addReviewer = mutation({
  args: {
    taskId: v.id("tasks"),
    reviewer: taskReviewerRef,
  },
  handler: async (ctx, args) => {
    const existingReviewer = await getTaskReviewer(
      ctx,
      args.taskId,
      args.reviewer
    )
    if (existingReviewer) return

    await ctx.db.insert("taskReviewers", {
      taskId: args.taskId,
      reviewer: args.reviewer,
      approvedAt: null,
      approvedBy: null,
    })
    await recomputeRelatedTaskStatuses(ctx, args.taskId)
  },
})

export const removeReviewer = mutation({
  args: {
    taskId: v.id("tasks"),
    reviewer: taskReviewerRef,
  },
  handler: async (ctx, args) => {
    const reviewer = await getTaskReviewer(ctx, args.taskId, args.reviewer)
    if (!reviewer) return

    await ctx.db.delete(reviewer._id)
    await recomputeRelatedTaskStatuses(ctx, args.taskId)
  },
})

export const approveReviewer = mutation({
  args: {
    taskId: v.id("tasks"),
    reviewer: taskReviewerRef,
  },
  handler: async (ctx, args) => {
    const userId = await getRequiredAuthUserId(ctx)

    const reviewer = await getTaskReviewer(ctx, args.taskId, args.reviewer)
    if (!reviewer) throw new Error("Task reviewer not found")

    await ctx.db.patch(reviewer._id, {
      approvedAt: Date.now(),
      approvedBy: userId,
    })
    await recomputeRelatedTaskStatuses(ctx, args.taskId)
  },
})

export const revokeReviewerApproval = mutation({
  args: {
    taskId: v.id("tasks"),
    reviewer: taskReviewerRef,
  },
  handler: async (ctx, args) => {
    const reviewer = await getTaskReviewer(ctx, args.taskId, args.reviewer)
    if (!reviewer) throw new Error("Task reviewer not found")

    await ctx.db.patch(reviewer._id, {
      approvedAt: null,
      approvedBy: null,
    })
    await recomputeRelatedTaskStatuses(ctx, args.taskId)
  },
})

export const overrideApproval = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await getRequiredAuthUserId(ctx)

    const existingOverride = await getTaskReviewOverride(ctx, args.taskId)
    const override = {
      taskId: args.taskId,
      overriddenAt: Date.now(),
      overriddenBy: userId,
    }

    if (existingOverride) {
      await ctx.db.patch(existingOverride._id, override)
    } else {
      await ctx.db.insert("taskReviewOverrides", override)
    }
    await recomputeRelatedTaskStatuses(ctx, args.taskId)
  },
})

export const removeApprovalOverride = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const override = await getTaskReviewOverride(ctx, args.taskId)
    if (!override) return

    await ctx.db.delete(override._id)
    await recomputeRelatedTaskStatuses(ctx, args.taskId)
  },
})
