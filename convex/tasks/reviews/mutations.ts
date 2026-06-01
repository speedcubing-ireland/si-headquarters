import { mutation } from "@/convex/_generated/server"
import {
  getTaskReviewer,
  getTaskReviewOverride,
} from "@/convex/tasks/reviews/reviewState"
import { taskReviewerRef } from "@/convex/tasks/reviews/validators"
import { recomputeRelatedTaskStatuses } from "@/convex/tasks/status/recompute"
import { requireTaskManagement } from "@/convex/permissions/principal"
import { v } from "convex/values"

export const addReviewer = mutation({
  args: {
    taskId: v.id("tasks"),
    reviewer: taskReviewerRef,
  },
  handler: async (ctx, args) => {
    await requireTaskManagement(ctx)
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
    await requireTaskManagement(ctx)
    const reviewer = await getTaskReviewer(ctx, args.taskId, args.reviewer)
    if (!reviewer) return

    await ctx.db.delete("taskReviewers", reviewer._id)
    await recomputeRelatedTaskStatuses(ctx, args.taskId)
  },
})

export const approveReviewer = mutation({
  args: {
    taskId: v.id("tasks"),
    reviewer: taskReviewerRef,
  },
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)

    const reviewer = await getTaskReviewer(ctx, args.taskId, args.reviewer)
    if (!reviewer) throw new Error("Task reviewer not found")

    await ctx.db.patch("taskReviewers", reviewer._id, {
      approvedAt: Date.now(),
      approvedBy: principal.userId,
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
    await requireTaskManagement(ctx)
    const reviewer = await getTaskReviewer(ctx, args.taskId, args.reviewer)
    if (!reviewer) throw new Error("Task reviewer not found")

    await ctx.db.patch("taskReviewers", reviewer._id, {
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
    const principal = await requireTaskManagement(ctx)

    const existingOverride = await getTaskReviewOverride(ctx, args.taskId)
    const override = {
      taskId: args.taskId,
      overriddenAt: Date.now(),
      overriddenBy: principal.userId,
    }

    if (existingOverride) {
      await ctx.db.patch("taskReviewOverrides", existingOverride._id, override)
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
    await requireTaskManagement(ctx)
    const override = await getTaskReviewOverride(ctx, args.taskId)
    if (!override) return

    await ctx.db.delete("taskReviewOverrides", override._id)
    await recomputeRelatedTaskStatuses(ctx, args.taskId)
  },
})
