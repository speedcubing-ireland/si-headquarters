import { internal } from "@/convex/_generated/api"
import { internalMutation, mutation, query } from "@/convex/_generated/server"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import { requireActiveUserId } from "@/convex/permissions/principal"
import { requireTaskReadAccess } from "@/convex/tasks/access"
import { v } from "convex/values"

const MIN_REMINDER_DELAY_MS = 60_000
const MAX_PENDING_REMINDERS_PER_TASK = 50

async function cancelScheduledIfPending(
  ctx: Pick<MutationCtx, "scheduler">,
  scheduledFunctionId: Id<"_scheduled_functions"> | null
) {
  if (scheduledFunctionId === null) return
  try {
    await ctx.scheduler.cancel(scheduledFunctionId)
  } catch {
    void 0
  }
}

function normalizeMessage(message: string | null | undefined) {
  const trimmed = message?.trim()
  return trimmed === undefined || trimmed.length === 0 ? null : trimmed
}

function validateFutureReminder(remindAt: number) {
  if (!Number.isFinite(remindAt)) throw new Error("Reminder time is invalid")
  if (remindAt < Date.now() + MIN_REMINDER_DELAY_MS) {
    throw new Error("Reminder time must be at least one minute in the future")
  }
}

export const listForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await requireActiveUserId(ctx)
    await requireTaskReadAccess(ctx, args.taskId)
    const reminders = await ctx.db
      .query("taskReminders")
      .withIndex(
        "by_taskId_and_userId_and_cancelledAt_and_sentAt_and_remindAt",
        (q) =>
          q
            .eq("taskId", args.taskId)
            .eq("userId", userId)
            .eq("cancelledAt", null)
            .eq("sentAt", null)
      )
      .take(MAX_PENDING_REMINDERS_PER_TASK)
    return reminders.map((reminder) => ({
      _id: reminder._id,
      taskId: reminder.taskId,
      userId: reminder.userId,
      remindAt: reminder.remindAt,
      message: reminder.message,
      sentAt: reminder.sentAt,
      cancelledAt: reminder.cancelledAt,
    }))
  },
})

export const createForTask = mutation({
  args: {
    taskId: v.id("tasks"),
    remindAt: v.number(),
    message: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await requireActiveUserId(ctx)
    await requireTaskReadAccess(ctx, args.taskId)
    validateFutureReminder(args.remindAt)
    const task = await ctx.db.get("tasks", args.taskId)
    if (task === null) throw new Error("Task not found")

    const reminderId = await ctx.db.insert("taskReminders", {
      taskId: args.taskId,
      userId,
      remindAt: args.remindAt,
      message: normalizeMessage(args.message),
      scheduledFunctionId: null,
      sentAt: null,
      cancelledAt: null,
      failedAt: null,
      lastError: null,
    })
    const scheduledFunctionId = await ctx.scheduler.runAt(
      args.remindAt,
      internal.notifications.reminders._fireReminder,
      { reminderId }
    )
    await ctx.db.patch("taskReminders", reminderId, { scheduledFunctionId })
    return reminderId
  },
})

export const cancel = mutation({
  args: { reminderId: v.id("taskReminders") },
  handler: async (ctx, args) => {
    const userId = await requireActiveUserId(ctx)
    const reminder = await ctx.db.get("taskReminders", args.reminderId)
    if (reminder === null) throw new Error("Reminder not found")
    if (reminder.userId !== userId) throw new Error("Reminder not found")
    if (
      reminder.sentAt !== null ||
      reminder.cancelledAt !== null ||
      reminder.failedAt !== null
    ) {
      return null
    }

    await cancelScheduledIfPending(ctx, reminder.scheduledFunctionId)
    await ctx.db.patch("taskReminders", reminder._id, {
      scheduledFunctionId: null,
      cancelledAt: Date.now(),
    })
    return null
  },
})

export const _fireReminder = internalMutation({
  args: { reminderId: v.id("taskReminders") },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get("taskReminders", args.reminderId)
    if (reminder === null) return null
    if (
      reminder.sentAt !== null ||
      reminder.cancelledAt !== null ||
      reminder.failedAt !== null
    ) {
      return null
    }
    if (reminder.remindAt > Date.now()) return null

    await ctx.db.patch("taskReminders", reminder._id, {
      scheduledFunctionId: null,
    })
    await scheduleNotificationEvent(ctx, {
      kind: "taskReminder",
      reminderId: reminder._id,
    })
    return null
  },
})

export const recordDispatchOutcome = internalMutation({
  args: {
    reminderId: v.id("taskReminders"),
    success: v.boolean(),
    errorMessage: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get("taskReminders", args.reminderId)
    if (reminder === null) return null
    if (reminder.cancelledAt !== null) return null
    if (reminder.sentAt !== null || reminder.failedAt !== null) return null

    const now = Date.now()
    if (args.success) {
      await ctx.db.patch("taskReminders", reminder._id, {
        sentAt: now,
        failedAt: null,
        lastError: null,
      })
      return null
    }

    await ctx.db.patch("taskReminders", reminder._id, {
      failedAt: now,
      lastError: args.errorMessage,
    })
    return null
  },
})

export async function rescheduleReminder(
  ctx: MutationCtx,
  reminderId: Id<"taskReminders">,
  remindAt: number
) {
  validateFutureReminder(remindAt)
  const reminder = await ctx.db.get("taskReminders", reminderId)
  if (reminder === null) throw new Error("Reminder not found")
  if (reminder.cancelledAt !== null) throw new Error("Reminder was cancelled")
  await cancelScheduledIfPending(ctx, reminder.scheduledFunctionId)
  const scheduledFunctionId = await ctx.scheduler.runAt(
    remindAt,
    internal.notifications.reminders._fireReminder,
    { reminderId }
  )
  await ctx.db.patch("taskReminders", reminderId, {
    remindAt,
    sentAt: null,
    cancelledAt: null,
    failedAt: null,
    lastError: null,
    scheduledFunctionId,
  })
}
