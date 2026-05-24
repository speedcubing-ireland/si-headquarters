import { query } from "@/convex/_generated/server"
import {
  getTaskOrThrow,
  getTaskReviewDetails,
  getTaskReviewState,
} from "@/convex/tasks/reviews/reviewState"
import { previewReviewChangeImpact } from "@/convex/tasks/reviews/preview"
import { reviewPreviewOperation } from "@/convex/tasks/reviews/validators"
import { v } from "convex/values"

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
