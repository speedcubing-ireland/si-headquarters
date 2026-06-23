import { internalMutation } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { nextConfiguredReminderTime } from "@/convex/notifications/localTime"
import {
  assignTaskAndNotify,
  scheduleTaskStatusNotifications,
} from "@/convex/notifications/events"
import { userDisplayName } from "@/convex/notifications/embeds"
import {
  notificationAction,
  type NotificationAction,
} from "@/convex/notifications/validators"
import { rescheduleReminder } from "@/convex/notifications/reminders"
import {
  buildPrincipalForUserId,
  canPerform,
} from "@/convex/permissions/principal"
import { v } from "convex/values"
import { getMembership } from "@/convex/teams/model"
import {
  concreteAssigneeIds,
  isClaimableAssigneeIds,
} from "@/convex/tasks/assignees"
import {
  recomputeRelatedTaskStatuses,
  requestTaskStatusChange,
} from "@/convex/tasks/status/recompute"
import { organisationConfig } from "@/config/lib/organisation"
const MAX_REVIEWERS_TO_APPROVE = 50

async function userForDiscordId(ctx: MutationCtx, discordUserId: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_discordUserId", (q) => q.eq("discordUserId", discordUserId))
    .unique()
  if (user === null || user.disabled === true) return null
  return user
}

function isClaimableTask(task: Doc<"tasks">) {
  return (
    isClaimableAssigneeIds(task.assigneeIds) &&
    (task.status === "to-do" || task.status === "in-progress")
  )
}

async function runClaimTask(
  ctx: MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">
) {
  const task = await ctx.db.get("tasks", taskId)
  if (task === null) return "This task no longer exists."
  if (!isClaimableAssigneeIds(task.assigneeIds)) {
    const [assigneeId] = concreteAssigneeIds(task.assigneeIds)
    if (assigneeId === userId) return "You have already claimed this task."
    const assignee = await ctx.db.get("users", assigneeId)
    return `This task was already claimed by **${userDisplayName(assignee, "someone else")}**. You cannot claim it.`
  }
  if (!isClaimableTask(task)) {
    return "This task cannot be claimed from its current state."
  }

  const principal = await buildPrincipalForUserId(ctx, userId)
  if (principal === null || !canPerform(principal, "manage", "Task")) {
    return "You cannot claim this task."
  }

  await assignTaskAndNotify(ctx, {
    taskId: task._id,
    actorId: userId,
    assigneeIds: [userId],
  })
  return "Task claimed."
}

async function runStartTask(
  ctx: MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">
) {
  const task = await ctx.db.get("tasks", taskId)
  if (task === null) return "This task no longer exists."

  const principal = await buildPrincipalForUserId(ctx, userId)
  const isAssignee = concreteAssigneeIds(task.assigneeIds).includes(userId)
  if (
    principal === null ||
    (!isAssignee && !canPerform(principal, "manage", "Task"))
  ) {
    return "You cannot start this task."
  }

  try {
    const result = await requestTaskStatusChange(ctx, task._id, "in-progress")
    await scheduleTaskStatusNotifications(ctx, result, userId)
  } catch {
    return "This task cannot be started from its current state."
  }
  return "Task started."
}

async function runApproveTaskReview(
  ctx: MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">
) {
  const task = await ctx.db.get("tasks", taskId)
  if (task === null) return "This task no longer exists."

  const reviewers = await ctx.db
    .query("taskReviewers")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .take(MAX_REVIEWERS_TO_APPROVE)
  const now = Date.now()
  const approvable: Id<"taskReviewers">[] = []

  for (const reviewer of reviewers) {
    if (reviewer.approvedAt !== null) continue
    if (reviewer.reviewer.type === "users" && reviewer.reviewer.id === userId) {
      approvable.push(reviewer._id)
      continue
    }
    if (
      reviewer.reviewer.type === "teams" &&
      (await getMembership(ctx, reviewer.reviewer.id, userId)) !== null
    ) {
      approvable.push(reviewer._id)
    }
  }

  if (approvable.length === 0) {
    return "There is no pending review for you to approve."
  }

  for (const reviewerId of approvable) {
    await ctx.db.patch("taskReviewers", reviewerId, {
      approvedAt: now,
      approvedBy: userId,
    })
  }
  const result = await recomputeRelatedTaskStatuses(ctx, taskId)
  await scheduleTaskStatusNotifications(ctx, result, userId)
  return approvable.length === 1 ? "Review approved." : "Team reviews approved."
}

async function runSnoozeReminder(
  ctx: MutationCtx,
  userId: Id<"users">,
  reminderId: Id<"taskReminders">,
  preset: Extract<NotificationAction, { kind: "snoozeReminder" }>["preset"]
) {
  const reminder = await ctx.db.get("taskReminders", reminderId)
  if (reminder === null || reminder.userId !== userId) {
    return "This reminder no longer exists."
  }
  if (reminder.cancelledAt !== null) {
    return "This reminder has already been cancelled."
  }
  const remindAt =
    preset === "1h" ? Date.now() + 60 * 60 * 1000 : nextConfiguredReminderTime()
  await rescheduleReminder(ctx, reminderId, remindAt)
  return preset === "1h"
    ? "Reminder snoozed for 1 hour."
    : "Reminder snoozed until tomorrow morning."
}

async function executeAction(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: NotificationAction
) {
  switch (action.kind) {
    case "claimTask":
      return await runClaimTask(ctx, userId, action.taskId)
    case "approveTaskReview":
      return await runApproveTaskReview(ctx, userId, action.taskId)
    case "startTask":
      return await runStartTask(ctx, userId, action.taskId)
    case "snoozeReminder":
      return await runSnoozeReminder(
        ctx,
        userId,
        action.reminderId,
        action.preset
      )
  }
}

export const executeDiscordAction = internalMutation({
  args: {
    discordUserId: v.string(),
    action: notificationAction,
  },
  handler: async (ctx, args) => {
    const user = await userForDiscordId(ctx, args.discordUserId)
    if (user === null) {
      return {
        content: `Discord is not linked to an active ${organisationConfig.organisation.productName} user.`,
      }
    }

    const content = await executeAction(ctx, user._id, args.action)
    if (args.action.kind !== "claimTask") return { content }

    const task = await ctx.db.get("tasks", args.action.taskId)
    return {
      content,
      updateMessage:
        task !== null && !isClaimableAssigneeIds(task.assigneeIds)
          ? args.action.taskId
          : undefined,
    }
  },
})
