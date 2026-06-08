import { internal } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { internalMutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  dublinDateOffset,
  dublinToday,
  isDublinLocalHour,
} from "@/convex/notifications/time"
import type { DueNoticeKind } from "@/convex/notifications/validators"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { v } from "convex/values"

const DUE_SCAN_PAGE_SIZE = 250

async function markNoticeSentIfNew(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  dueDate: string,
  kind: DueNoticeKind
) {
  const existing = await ctx.db
    .query("taskDueNoticeStates")
    .withIndex("by_taskId_and_dueDate_and_kind", (q) =>
      q.eq("taskId", task._id).eq("dueDate", dueDate).eq("kind", kind)
    )
    .unique()
  if (existing !== null) return false
  await ctx.db.insert("taskDueNoticeStates", {
    taskId: task._id,
    dueDate,
    kind,
    sentAt: Date.now(),
  })
  return true
}

async function sendDueSoon(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  today: string
) {
  if (task.dueDate !== today || !Array.isArray(task.assigneeIds)) {
    return
  }
  if (!(await markNoticeSentIfNew(ctx, task, today, "due-soon"))) return
  await scheduleNotificationEvent(ctx, {
    kind: "taskDueSoon",
    taskId: task._id,
    dueDate: today,
  })
}

async function sendOverdue(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  today: string
) {
  if (task.dueDate === null || task.dueDate >= today) return
  if (!(await markNoticeSentIfNew(ctx, task, task.dueDate, "overdue"))) return

  await scheduleNotificationEvent(ctx, {
    kind: "taskOverdue",
    taskId: task._id,
    dueDate: task.dueDate,
    today,
  })
}

async function scanDuePage(
  ctx: MutationCtx,
  input: {
    nowMs: number
    cursor: string | null
  }
) {
  if (!isDublinLocalHour(8, input.nowMs)) return

  const today = dublinToday(input.nowMs)
  const tomorrow = dublinDateOffset(today, 1)
  const page = await ctx.db
    .query("tasks")
    .withIndex("by_dueDate", (q) =>
      q.gt("dueDate", "").lte("dueDate", tomorrow)
    )
    .paginate({
      numItems: DUE_SCAN_PAGE_SIZE,
      cursor: input.cursor,
    })

  for (const task of page.page) {
    if (task.dueDate === null || isTerminalComplete(task.status)) continue
    await sendDueSoon(ctx, task, tomorrow)
    await sendOverdue(ctx, task, today)
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.due._continueDueScan,
      {
        nowMs: input.nowMs,
        cursor: page.continueCursor,
      }
    )
  }
}

export const runDueScan = internalMutation({
  args: { nowMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now()
    await scanDuePage(ctx, { nowMs, cursor: null })
    return null
  },
})

export const _continueDueScan = internalMutation({
  args: {
    nowMs: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await scanDuePage(ctx, args)
    return null
  },
})
