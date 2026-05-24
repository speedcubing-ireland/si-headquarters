import { v, type Infer } from "convex/values"

export const taskReviewerRef = v.union(
  ...(["users", "teams"] as const).map((tableName) =>
    v.object({
      type: v.literal(tableName),
      id: v.id(tableName),
    })
  )
)

export const taskReviewerFields = {
  taskId: v.id("tasks"),
  reviewer: taskReviewerRef,
  approvedAt: v.union(v.number(), v.null()),
  approvedBy: v.union(v.id("users"), v.null()),
}

export const taskReviewOverrideFields = {
  taskId: v.id("tasks"),
  overriddenAt: v.number(),
  overriddenBy: v.id("users"),
}

export const reviewPreviewOperation = v.union(
  v.object({
    type: v.literal("add-reviewer"),
    reviewer: taskReviewerRef,
  }),
  v.object({
    type: v.literal("remove-reviewer"),
    reviewer: taskReviewerRef,
  }),
  v.object({
    type: v.literal("approve-reviewer"),
    reviewer: taskReviewerRef,
  }),
  v.object({
    type: v.literal("revoke-reviewer-approval"),
    reviewer: taskReviewerRef,
  }),
  v.object({
    type: v.literal("override-approval"),
  }),
  v.object({
    type: v.literal("remove-approval-override"),
  })
)

export type TaskReviewerRef = Infer<typeof taskReviewerRef>
export type ReviewPreviewOperation = Infer<typeof reviewPreviewOperation>
