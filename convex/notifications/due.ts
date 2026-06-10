import { internal } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { internalMutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import { competitionOrProjectRef, objectRefKey } from "@/convex/utils"
import type { CompetitionOrProjectRef } from "@/convex/utils"
import {
  dublinDateOffset,
  dublinToday,
  isDublinLocalHour,
} from "@/convex/notifications/time"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import { getTaskWatcherIds } from "@/convex/tasks/watchers"
import {
  currentPhaseIdForOwner,
  isTaskDocOverdue,
  loadOwnerPhaseScanContext,
} from "@/convex/tasks/overdue"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { v } from "convex/values"

const DUE_SCAN_PAGE_SIZE = 250
const TASK_SCAN_PAGE_SIZE = 250

interface OverdueOwnerGroup {
  owner: CompetitionOrProjectRef
  taskIds: Id<"tasks">[]
}

async function sendDueSoon(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  tomorrow: string
) {
  if (task.dueDate !== tomorrow || !Array.isArray(task.assigneeIds)) {
    return
  }
  await scheduleNotificationEvent(ctx, {
    kind: "taskDueSoon",
    taskId: task._id,
    dueDate: tomorrow,
  })
}

async function scanDueSoonPage(
  ctx: MutationCtx,
  input: {
    cursor: string | null
    tomorrow: string
  }
) {
  const page = await ctx.db
    .query("tasks")
    .withIndex("by_dueDate", (q) =>
      q.gt("dueDate", "").lte("dueDate", input.tomorrow)
    )
    .paginate({
      numItems: DUE_SCAN_PAGE_SIZE,
      cursor: input.cursor,
    })

  for (const task of page.page) {
    if (task.dueDate === null || isTerminalComplete(task.status)) continue
    await sendDueSoon(ctx, task, input.tomorrow)
  }

  return page
}

async function scanOverdueTasksPage(
  ctx: MutationCtx,
  input: {
    today: string
    phaseSortKeyById: Map<Id<"phases">, string>
    competitionPhaseById: Map<Id<"competitions">, Id<"phases"> | null>
    projectPhaseById: Map<Id<"projects">, Id<"phases"> | null>
    overdueByOwner: Map<string, OverdueOwnerGroup>
    cursor: string | null
  }
) {
  const page = await ctx.db.query("tasks").paginate({
    numItems: TASK_SCAN_PAGE_SIZE,
    cursor: input.cursor,
  })

  for (const task of page.page) {
    if (isTerminalComplete(task.status)) continue
    const ownerCurrentPhaseId = currentPhaseIdForOwner(
      task.root,
      input.competitionPhaseById,
      input.projectPhaseById
    )
    if (
      !isTaskDocOverdue(task, ownerCurrentPhaseId, {
        today: input.today,
        phaseSortKeyById: input.phaseSortKeyById,
      })
    ) {
      continue
    }

    const ownerKey = objectRefKey(task.root)
    const existing = input.overdueByOwner.get(ownerKey)
    if (existing !== undefined) {
      existing.taskIds.push(task._id)
      continue
    }
    input.overdueByOwner.set(ownerKey, {
      owner: task.root,
      taskIds: [task._id],
    })
  }

  return page
}

async function dispatchOverdueNotifications(
  ctx: MutationCtx,
  input: {
    today: string
    overdueByOwner: Map<string, OverdueOwnerGroup>
  }
) {
  for (const { owner, taskIds } of input.overdueByOwner.values()) {
    await scheduleNotificationEvent(ctx, {
      kind: "ownerOverdueSummary",
      owner,
      today: input.today,
      taskIds,
    })

    for (const taskId of taskIds) {
      const task = await ctx.db.get("tasks", taskId)
      if (task === null) continue
      const watcherIds = await getTaskWatcherIds(ctx, task)
      for (const userId of watcherIds) {
        await scheduleNotificationEvent(ctx, {
          kind: "taskOverdue",
          taskId,
          today: input.today,
          recipientId: userId,
        })
      }
    }
  }
}

async function runDueScanPass(
  ctx: MutationCtx,
  input: {
    nowMs: number
    dueSoonCursor: string | null
    overdueCursor: string | null
    tomorrow: string
    today: string
    phaseSortKeyById: Map<Id<"phases">, string>
    competitionPhaseById: Map<Id<"competitions">, Id<"phases"> | null>
    projectPhaseById: Map<Id<"projects">, Id<"phases"> | null>
    overdueByOwner: Map<string, OverdueOwnerGroup>
  }
) {
  if (input.dueSoonCursor !== null || input.overdueCursor === null) {
    const dueSoonPage = await scanDueSoonPage(ctx, {
      cursor: input.dueSoonCursor,
      tomorrow: input.tomorrow,
    })
    if (!dueSoonPage.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.due._continueDueScan,
        {
          nowMs: input.nowMs,
          dueSoonCursor: dueSoonPage.continueCursor,
          overdueCursor: input.overdueCursor,
          overdueByOwner: [...input.overdueByOwner.values()],
        }
      )
      return
    }
  }

  const overduePage = await scanOverdueTasksPage(ctx, {
    today: input.today,
    phaseSortKeyById: input.phaseSortKeyById,
    competitionPhaseById: input.competitionPhaseById,
    projectPhaseById: input.projectPhaseById,
    overdueByOwner: input.overdueByOwner,
    cursor: input.overdueCursor,
  })

  if (!overduePage.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.due._continueDueScan,
      {
        nowMs: input.nowMs,
        dueSoonCursor: null,
        overdueCursor: overduePage.continueCursor,
        overdueByOwner: [...input.overdueByOwner.values()],
      }
    )
    return
  }

  await dispatchOverdueNotifications(ctx, {
    today: input.today,
    overdueByOwner: input.overdueByOwner,
  })
}

async function continueDueScan(
  ctx: MutationCtx,
  input: {
    nowMs: number
    dueSoonCursor: string | null
    overdueCursor: string | null
    overdueByOwner: OverdueOwnerGroup[]
  }
) {
  if (!isDublinLocalHour(8, input.nowMs)) return null

  const today = dublinToday(input.nowMs)
  const tomorrow = dublinDateOffset(today, 1)
  const ownerContext = await loadOwnerPhaseScanContext(ctx)
  const overdueByOwner = new Map(
    input.overdueByOwner.map((entry) => [objectRefKey(entry.owner), entry])
  )

  await runDueScanPass(ctx, {
    nowMs: input.nowMs,
    dueSoonCursor: input.dueSoonCursor,
    overdueCursor: input.overdueCursor,
    tomorrow,
    today,
    ...ownerContext,
    overdueByOwner,
  })
  return null
}

export const runDueScan = internalMutation({
  args: { nowMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now()
    return await continueDueScan(ctx, {
      nowMs,
      dueSoonCursor: null,
      overdueCursor: null,
      overdueByOwner: [],
    })
  },
})

export const _continueDueScan = internalMutation({
  args: {
    nowMs: v.number(),
    dueSoonCursor: v.union(v.string(), v.null()),
    overdueCursor: v.union(v.string(), v.null()),
    overdueByOwner: v.array(
      v.object({
        owner: competitionOrProjectRef,
        taskIds: v.array(v.id("tasks")),
      })
    ),
  },
  handler: async (ctx, args) =>
    continueDueScan(ctx, {
      nowMs: args.nowMs,
      dueSoonCursor: args.dueSoonCursor,
      overdueCursor: args.overdueCursor,
      overdueByOwner: args.overdueByOwner,
    }),
})
