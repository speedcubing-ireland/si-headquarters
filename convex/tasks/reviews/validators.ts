import { v, type Infer } from "convex/values"
import { publicUserValidator } from "@/convex/users/validators"
import { objectRef } from "@/convex/utils"

export const taskReviewerRef = v.union(objectRef("users"), objectRef("teams"))

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

export const taskReviewStateSummary = v.object({
  status: v.union(
    v.literal("not-required"),
    v.literal("pending"),
    v.literal("approved")
  ),
  hasReviews: v.boolean(),
  hasPendingReviews: v.boolean(),
  isApproved: v.boolean(),
  isOverridden: v.boolean(),
})

export const taskReviewerDetails = v.object({
  _id: v.id("taskReviewers"),
  reviewer: taskReviewerRef,
  name: v.union(v.string(), v.null()),
  approved: v.boolean(),
  approvedAt: v.union(v.number(), v.null()),
})

export const taskReviewOverrideDetails = v.object({
  _id: v.id("taskReviewOverrides"),
  overriddenAt: v.number(),
  overriddenBy: v.union(publicUserValidator, v.null()),
})

export const taskReviewerDetailsForTask = v.object({
  state: taskReviewStateSummary,
  reviewers: v.array(taskReviewerDetails),
  override: v.union(taskReviewOverrideDetails, v.null()),
})

export const potentialTaskReviewers = v.object({
  teams: v.array(
    v.object({
      _id: v.id("teams"),
      name: v.string(),
    })
  ),
  users: v.array(publicUserValidator),
})

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
export type TaskReviewerDetails = Infer<typeof taskReviewerDetails>
export type TaskReviewOverrideDetails = Infer<typeof taskReviewOverrideDetails>
export type TaskReviewerDetailsForTask = Infer<
  typeof taskReviewerDetailsForTask
>
export type PotentialTaskReviewers = Infer<typeof potentialTaskReviewers>
export type ReviewPreviewOperation = Infer<typeof reviewPreviewOperation>
