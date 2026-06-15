import { internal } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { internalMutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  dublinDateOffset,
  dublinToday,
  isDublinLocalTimeInWindow,
} from "@/convex/notifications/time"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { competitionOrProjectRef } from "@/convex/utils"
import { v, type Infer } from "convex/values"

const DAILY_SCAN_STATE_KEY = "daily"
const DUE_SOON_PAGE_SIZE = 100
const OVERDUE_TASK_PAGE_SIZE = 8
const SUMMARY_TASK_PREVIEW_LIMIT = 5
const SCAN_WINDOW_START_HOUR = 8
const SCAN_WINDOW_END_HOUR = 10

const overdueScanStateValidator = v.object({
  nowMs: v.number(),
  ownerTable: v.union(v.literal("competitions"), v.literal("projects")),
  ownerCursor: v.union(v.string(), v.null()),
  ownerPageIsDone: v.boolean(),
  owner: v.union(competitionOrProjectRef, v.null()),
  currentPhaseSortKey: v.union(v.string(), v.null()),
  taskCursor: v.union(v.string(), v.null()),
  summaryTaskIds: v.array(v.id("tasks")),
  overdueCount: v.number(),
})

type OverdueScanState = Infer<typeof overdueScanStateValidator>

async function scheduleOverdueScan(ctx: MutationCtx, state: OverdueScanState) {
  await ctx.scheduler.runAfter(
    0,
    internal.notifications.due._continueOverdueScan,
    { state }
  )
}

function freshOwnerState(
  state: OverdueScanState,
  ownerTable: OverdueScanState["ownerTable"],
  ownerCursor: string | null
): OverdueScanState {
  return {
    ...state,
    ownerTable,
    ownerCursor,
    ownerPageIsDone: false,
    owner: null,
    currentPhaseSortKey: null,
    taskCursor: null,
    summaryTaskIds: [],
    overdueCount: 0,
  }
}

async function taskIsOverdue(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  today: string,
  currentPhaseSortKey: string | null,
  phaseSortKeyCache: Map<Id<"phases">, string | null>
) {
  if (task.dueDate !== null && task.dueDate < today) {
    return true
  }
  if (currentPhaseSortKey === null || task.parent.type !== "phases") {
    return false
  }

  const phaseId = task.parent.id
  let taskPhaseSortKey = phaseSortKeyCache.get(phaseId)
  if (taskPhaseSortKey === undefined) {
    taskPhaseSortKey = (await ctx.db.get("phases", phaseId))?.sortKey ?? null
    phaseSortKeyCache.set(phaseId, taskPhaseSortKey)
  }
  return taskPhaseSortKey !== null && taskPhaseSortKey < currentPhaseSortKey
}

async function scanDueSoonPage(
  ctx: MutationCtx,
  nowMs: number,
  cursor: string | null
) {
  const tomorrow = dublinDateOffset(dublinToday(nowMs), 1)
  const page = await ctx.db
    .query("tasks")
    .withIndex("by_dueDate", (q) => q.eq("dueDate", tomorrow))
    .paginate({ numItems: DUE_SOON_PAGE_SIZE, cursor })

  for (const task of page.page) {
    if (isTerminalComplete(task.status) || !Array.isArray(task.assigneeIds)) {
      continue
    }
    await scheduleNotificationEvent(ctx, {
      kind: "taskDueSoon",
      taskId: task._id,
      dueDate: tomorrow,
    })
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.due._continueDueSoonScan,
      {
        nowMs,
        cursor: page.continueCursor,
      }
    )
    return
  }

  await scheduleOverdueScan(ctx, {
    nowMs,
    ownerTable: "competitions",
    ownerCursor: null,
    ownerPageIsDone: false,
    owner: null,
    currentPhaseSortKey: null,
    taskCursor: null,
    summaryTaskIds: [],
    overdueCount: 0,
  })
}

async function selectNextOwner(ctx: MutationCtx, state: OverdueScanState) {
  let owner: NonNullable<OverdueScanState["owner"]>
  let phaseId: Id<"phases"> | null
  let ownerCursor: string
  let ownerPageIsDone: boolean

  if (state.ownerTable === "competitions") {
    const page = await ctx.db.query("competitions").paginate({
      numItems: 1,
      cursor: state.ownerCursor,
    })
    if (page.page.length === 0) {
      return selectNextOwner(ctx, freshOwnerState(state, "projects", null))
    }
    const competition = page.page[0]
    owner = { type: "competitions", id: competition._id }
    phaseId = competition.phaseId
    ownerCursor = page.continueCursor
    ownerPageIsDone = page.isDone
  } else {
    const page = await ctx.db.query("projects").paginate({
      numItems: 1,
      cursor: state.ownerCursor,
    })
    if (page.page.length === 0) {
      return null
    }
    const project = page.page[0]
    owner = { type: "projects", id: project._id }
    phaseId = project.phaseId
    ownerCursor = page.continueCursor
    ownerPageIsDone = page.isDone
  }

  return {
    ...state,
    ownerCursor,
    ownerPageIsDone,
    owner,
    currentPhaseSortKey:
      phaseId === null
        ? null
        : ((await ctx.db.get("phases", phaseId))?.sortKey ?? null),
    taskCursor: null,
    summaryTaskIds: [],
    overdueCount: 0,
  }
}

async function runOverdueScanPass(ctx: MutationCtx, state: OverdueScanState) {
  const scanState =
    state.owner === null ? await selectNextOwner(ctx, state) : state
  if (scanState === null) {
    return
  }
  const owner = scanState.owner
  if (owner === null) {
    return
  }

  const today = dublinToday(scanState.nowMs)
  const page = await ctx.db
    .query("tasks")
    .withIndex("by_root_type_and_root_id", (q) =>
      q.eq("root.type", owner.type).eq("root.id", owner.id)
    )
    .paginate({
      numItems: OVERDUE_TASK_PAGE_SIZE,
      cursor: scanState.taskCursor,
    })
  const phaseSortKeyCache = new Map<Id<"phases">, string | null>()
  const summaryTaskIds = [...scanState.summaryTaskIds]
  let overdueCount = scanState.overdueCount

  for (const task of page.page) {
    if (
      isTerminalComplete(task.status) ||
      !(await taskIsOverdue(
        ctx,
        task,
        today,
        scanState.currentPhaseSortKey,
        phaseSortKeyCache
      ))
    ) {
      continue
    }
    await scheduleNotificationEvent(ctx, {
      kind: "taskOverdue",
      taskId: task._id,
      today,
    })
    overdueCount += 1
    if (summaryTaskIds.length < SUMMARY_TASK_PREVIEW_LIMIT) {
      summaryTaskIds.push(task._id)
    }
  }

  if (!page.isDone) {
    await scheduleOverdueScan(ctx, {
      ...scanState,
      taskCursor: page.continueCursor,
      summaryTaskIds,
      overdueCount,
    })
    return
  }

  if (overdueCount > 0) {
    await scheduleNotificationEvent(ctx, {
      kind: "ownerOverdueSummary",
      owner,
      today,
      taskIds: summaryTaskIds,
      totalCount: overdueCount,
    })
  }

  if (!scanState.ownerPageIsDone) {
    await scheduleOverdueScan(
      ctx,
      freshOwnerState(scanState, scanState.ownerTable, scanState.ownerCursor)
    )
  } else if (scanState.ownerTable === "competitions") {
    await scheduleOverdueScan(ctx, freshOwnerState(scanState, "projects", null))
  }
}

async function claimDailyScan(ctx: MutationCtx, today: string) {
  const existing = await ctx.db
    .query("notificationDueScanStates")
    .withIndex("by_key", (q) => q.eq("key", DAILY_SCAN_STATE_KEY))
    .unique()
  if (existing?.lastRunDate === today) {
    return false
  }
  if (existing === null) {
    await ctx.db.insert("notificationDueScanStates", {
      key: DAILY_SCAN_STATE_KEY,
      lastRunDate: today,
    })
  } else {
    await ctx.db.patch("notificationDueScanStates", existing._id, {
      lastRunDate: today,
    })
  }
  return true
}

export const runDueScan = internalMutation({
  args: { nowMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now()
    if (
      !isDublinLocalTimeInWindow(
        SCAN_WINDOW_START_HOUR,
        SCAN_WINDOW_END_HOUR,
        nowMs
      ) ||
      !(await claimDailyScan(ctx, dublinToday(nowMs)))
    ) {
      return
    }
    await scanDueSoonPage(ctx, nowMs, null)
  },
})

export const _continueDueSoonScan = internalMutation({
  args: {
    nowMs: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await scanDueSoonPage(ctx, args.nowMs, args.cursor)
  },
})

export const _continueOverdueScan = internalMutation({
  args: { state: overdueScanStateValidator },
  handler: async (ctx, args) => {
    await runOverdueScanPass(ctx, args.state)
  },
})
