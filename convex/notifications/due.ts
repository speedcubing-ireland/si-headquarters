import { internal } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { internalMutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  localDateOffset,
  localToday,
  isConfiguredLocalTimeInWindow,
} from "@/convex/notifications/localTime"
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

// Convex allows a single paginated query per function invocation. The overdue
// scan is therefore split into discrete scheduled steps that each paginate at
// most once. This guard turns an accidental second paginate into a loud error
// inside `convex-test` too (the test runtime does not enforce the rule itself),
// so a regression surfaces in CI instead of only in production.
const paginatedInInvocation = new WeakSet<MutationCtx>()
function markPaginate(ctx: MutationCtx, label: string) {
  if (paginatedInInvocation.has(ctx)) {
    throw new Error(
      `due scan ran a second paginated query (${label}) in one mutation; ` +
        `split it into a separate scheduled step ` +
        `(Convex allows one paginated query per function)`
    )
  }
  paginatedInInvocation.add(ctx)
}

const overdueScanStateValidator = v.object({
  nowMs: v.number(),
  ownerTable: v.union(v.literal("competitions"), v.literal("projects")),
  ownerCursor: v.union(v.string(), v.null()),
  owner: v.union(competitionOrProjectRef, v.null()),
  currentPhaseSortKey: v.union(v.string(), v.null()),
  taskCursor: v.union(v.string(), v.null()),
  summaryTaskIds: v.array(v.id("tasks")),
  overdueCount: v.number(),
})

type OverdueScanState = Infer<typeof overdueScanStateValidator>

async function scheduleSelectOverdueOwner(
  ctx: MutationCtx,
  state: OverdueScanState
) {
  await ctx.scheduler.runAfter(
    0,
    internal.notifications.due._selectOverdueOwner,
    { state }
  )
}

async function scheduleScanOverdueOwnerTasks(
  ctx: MutationCtx,
  state: OverdueScanState
) {
  await ctx.scheduler.runAfter(
    0,
    internal.notifications.due._scanOverdueOwnerTasks,
    { state }
  )
}

function ownerScanState(
  nowMs: number,
  ownerTable: OverdueScanState["ownerTable"],
  ownerCursor: string | null
): OverdueScanState {
  return {
    nowMs,
    ownerTable,
    ownerCursor,
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
  const tomorrow = localDateOffset(localToday(nowMs), 1)
  markPaginate(ctx, "dueSoon tasks")
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

  await scheduleSelectOverdueOwner(
    ctx,
    ownerScanState(nowMs, "competitions", null)
  )
}

// Owner-selection step: paginates the owner table (competitions, then projects)
// one row at a time, then hands the populated state to the task-scan step. When
// a table is exhausted it moves to the next table via a fresh scheduled step
// rather than a second paginate in this invocation.
async function selectOverdueOwner(ctx: MutationCtx, state: OverdueScanState) {
  let owner: NonNullable<OverdueScanState["owner"]>
  let phaseId: Id<"phases"> | null
  let ownerCursor: string

  if (state.ownerTable === "competitions") {
    markPaginate(ctx, "select competitions")
    const page = await ctx.db.query("competitions").paginate({
      numItems: 1,
      cursor: state.ownerCursor,
    })
    if (page.page.length === 0) {
      await scheduleSelectOverdueOwner(
        ctx,
        ownerScanState(state.nowMs, "projects", null)
      )
      return
    }
    const competition = page.page[0]
    owner = { type: "competitions", id: competition._id }
    phaseId = competition.phaseId
    ownerCursor = page.continueCursor
  } else {
    markPaginate(ctx, "select projects")
    const page = await ctx.db.query("projects").paginate({
      numItems: 1,
      cursor: state.ownerCursor,
    })
    if (page.page.length === 0) {
      return
    }
    const project = page.page[0]
    owner = { type: "projects", id: project._id }
    phaseId = project.phaseId
    ownerCursor = page.continueCursor
  }

  await scheduleScanOverdueOwnerTasks(ctx, {
    ...state,
    ownerCursor,
    owner,
    currentPhaseSortKey:
      phaseId === null
        ? null
        : ((await ctx.db.get("phases", phaseId))?.sortKey ?? null),
    taskCursor: null,
    summaryTaskIds: [],
    overdueCount: 0,
  })
}

// Task-scan step: paginates the selected owner's tasks. Reschedules itself for
// further task pages, then advances to the next owner once the owner is fully
// scanned.
async function scanOverdueOwnerTasks(
  ctx: MutationCtx,
  state: OverdueScanState
) {
  const owner = state.owner
  if (owner === null) {
    return
  }

  const today = localToday(state.nowMs)
  markPaginate(ctx, "scan owner tasks")
  const page = await ctx.db
    .query("tasks")
    .withIndex("by_root_type_and_root_id", (q) =>
      q.eq("root.type", owner.type).eq("root.id", owner.id)
    )
    .paginate({
      numItems: OVERDUE_TASK_PAGE_SIZE,
      cursor: state.taskCursor,
    })
  const phaseSortKeyCache = new Map<Id<"phases">, string | null>()
  const summaryTaskIds = [...state.summaryTaskIds]
  let overdueCount = state.overdueCount

  for (const task of page.page) {
    if (
      isTerminalComplete(task.status) ||
      !(await taskIsOverdue(
        ctx,
        task,
        today,
        state.currentPhaseSortKey,
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
    await scheduleScanOverdueOwnerTasks(ctx, {
      ...state,
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

  // Resume owner selection from the cursor just past this owner. When the
  // current table is exhausted `selectOverdueOwner` advances to the next table
  // (or finishes), so table transitions live in exactly one place.
  await scheduleSelectOverdueOwner(
    ctx,
    ownerScanState(state.nowMs, state.ownerTable, state.ownerCursor)
  )
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
      !isConfiguredLocalTimeInWindow(
        SCAN_WINDOW_START_HOUR,
        SCAN_WINDOW_END_HOUR,
        nowMs
      ) ||
      !(await claimDailyScan(ctx, localToday(nowMs)))
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

export const _selectOverdueOwner = internalMutation({
  args: { state: overdueScanStateValidator },
  handler: async (ctx, args) => {
    await selectOverdueOwner(ctx, args.state)
  },
})

export const _scanOverdueOwnerTasks = internalMutation({
  args: { state: overdueScanStateValidator },
  handler: async (ctx, args) => {
    await scanOverdueOwnerTasks(ctx, args.state)
  },
})
