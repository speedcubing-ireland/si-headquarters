import { mutation, query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import { requireActiveUserId } from "@/convex/permissions/principal"
import { concreteAssigneeIds } from "@/convex/tasks/assignees"
import { requireTaskReadAccess } from "@/convex/tasks/access"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { v } from "convex/values"

export const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000

type NudgeReadCtx = Pick<QueryCtx, "db">

async function listEligibleNudgeRecipientIds(
  ctx: NudgeReadCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  now: number
) {
  const recipientIds: Id<"users">[] = []
  for (const assigneeId of concreteAssigneeIds(task.assigneeIds)) {
    if (assigneeId === actorId) continue
    const cooldown = await ctx.db
      .query("taskNudgeCooldowns")
      .withIndex("by_taskId_and_assigneeId", (q) =>
        q.eq("taskId", task._id).eq("assigneeId", assigneeId)
      )
      .unique()
    if (cooldown !== null && cooldown.lastNudgedAt > now - NUDGE_COOLDOWN_MS) {
      continue
    }
    recipientIds.push(assigneeId)
  }
  return recipientIds
}

async function refreshNudgeCooldowns(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  recipientIds: readonly Id<"users">[],
  now: number
) {
  for (const assigneeId of recipientIds) {
    const cooldown = await ctx.db
      .query("taskNudgeCooldowns")
      .withIndex("by_taskId_and_assigneeId", (q) =>
        q.eq("taskId", taskId).eq("assigneeId", assigneeId)
      )
      .unique()
    if (cooldown === null) {
      await ctx.db.insert("taskNudgeCooldowns", {
        taskId,
        assigneeId,
        lastNudgedAt: now,
      })
    } else {
      await ctx.db.patch("taskNudgeCooldowns", cooldown._id, {
        lastNudgedAt: now,
      })
    }
  }
}

export async function nudgeTaskAssignees(
  ctx: MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">
): Promise<string> {
  const task = await ctx.db.get("tasks", taskId)
  if (task === null) return "This task no longer exists."
  if (isTerminalComplete(task.status)) {
    return "This task is already complete."
  }

  const now = Date.now()
  const recipientIds = await listEligibleNudgeRecipientIds(
    ctx,
    task,
    userId,
    now
  )
  if (recipientIds.length === 0) {
    return "Nobody can be nudged for this task right now."
  }

  await refreshNudgeCooldowns(ctx, taskId, recipientIds, now)
  await scheduleNotificationEvent(ctx, {
    kind: "taskNudge",
    taskId,
    actorId: userId,
    recipientIds,
  })
  return "Nudge sent."
}

export const getEligibility = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await requireActiveUserId(ctx)
    const existingTask = await ctx.db.get("tasks", args.taskId)
    if (existingTask === null) {
      return { canNudge: false as const, reason: "missing_task" as const }
    }
    const { task } = await requireTaskReadAccess(ctx, args.taskId)
    if (!Array.isArray(task.assigneeIds) || task.assigneeIds.length === 0) {
      return { canNudge: false as const, reason: "no_assignees" as const }
    }
    if (isTerminalComplete(task.status)) {
      return { canNudge: false as const, reason: "complete" as const }
    }

    const assigneeIds = concreteAssigneeIds(task.assigneeIds)
    const otherAssigneeIds = assigneeIds.filter(
      (assigneeId) => assigneeId !== userId
    )
    if (otherAssigneeIds.length === 0) {
      return { canNudge: false as const, reason: "claimed" as const }
    }

    const now = Date.now()
    const eligibleRecipientIds = await listEligibleNudgeRecipientIds(
      ctx,
      task,
      userId,
      now
    )
    if (eligibleRecipientIds.length === 0) {
      return { canNudge: false as const, reason: "cooldown" as const }
    }
    return {
      canNudge: true as const,
      eligibleRecipientCount: eligibleRecipientIds.length,
    }
  },
})

export const nudgeTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await requireActiveUserId(ctx)
    await requireTaskReadAccess(ctx, args.taskId)
    const message = await nudgeTaskAssignees(ctx, userId, args.taskId)
    if (message !== "Nudge sent.") {
      throw new Error(message)
    }
    return null
  },
})
