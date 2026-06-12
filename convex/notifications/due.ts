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
import { OPEN_TASK_STATUSES } from "@/convex/tasks/status/validators"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { v } from "convex/values"

const DUE_SCAN_PAGE_SIZE = 250
const CARRYOVER_OWNERS_PER_PASS = 50
const DISPATCH_TASK_BUDGET = 50

const SCAN_OPEN_STATUSES = [
  ...OPEN_TASK_STATUSES,
  "awaiting-review",
] as const

type DueScanStage = "dueSoon" | "dateOverdue" | "phaseCarryover"

interface OverdueOwnerGroup {
  owner: CompetitionOrProjectRef
  taskIds: Id<"tasks">[]
}

const overdueByOwnerValidator = v.array(
  v.object({
    owner: competitionOrProjectRef,
    taskIds: v.array(v.id("tasks")),
  })
)

function mergeTaskIntoOverdueByOwner(
  overdueByOwner: Map<string, OverdueOwnerGroup>,
  task: Doc<"tasks">
) {
  const ownerKey = objectRefKey(task.root)
  const existing = overdueByOwner.get(ownerKey)
  if (existing !== undefined) {
    if (!existing.taskIds.includes(task._id)) {
      existing.taskIds.push(task._id)
    }
    return
  }
  overdueByOwner.set(ownerKey, {
    owner: task.root,
    taskIds: [task._id],
  })
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
    .withIndex("by_dueDate", (q) => q.eq("dueDate", input.tomorrow))
    .paginate({
      numItems: DUE_SCAN_PAGE_SIZE,
      cursor: input.cursor,
    })

  for (const task of page.page) {
    if (isTerminalComplete(task.status)) continue
    await sendDueSoon(ctx, task, input.tomorrow)
  }

  return page
}

async function scanDateOverduePage(
  ctx: MutationCtx,
  input: {
    today: string
    status: (typeof SCAN_OPEN_STATUSES)[number]
    cursor: string | null
    overdueByOwner: Map<string, OverdueOwnerGroup>
  }
) {
  const page = await ctx.db
    .query("tasks")
    .withIndex("by_status_and_dueDate", (q) =>
      q
        .eq("status", input.status)
        .gt("dueDate", "")
        .lt("dueDate", input.today)
    )
    .paginate({
      numItems: DUE_SCAN_PAGE_SIZE,
      cursor: input.cursor,
    })

  for (const task of page.page) {
    mergeTaskIntoOverdueByOwner(input.overdueByOwner, task)
  }

  return page
}

async function earlierPhaseIdsForOwner(
  ctx: MutationCtx,
  owner: CompetitionOrProjectRef,
  currentPhaseId: Id<"phases">
): Promise<Set<Id<"phases">>> {
  const currentPhase = await ctx.db.get("phases", currentPhaseId)
  if (currentPhase === null) return new Set()

  const phases = await ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", owner.type).eq("owner.id", owner.id)
    )
    .order("asc")
    .collect()

  const currentSortKey = currentPhase.sortKey
  const earlier = new Set<Id<"phases">>()
  for (const phase of phases) {
    if (phase.sortKey < currentSortKey) {
      earlier.add(phase._id)
    }
  }
  return earlier
}

async function scanCarryoverTasksForOwner(
  ctx: MutationCtx,
  owner: CompetitionOrProjectRef,
  earlierPhaseIds: Set<Id<"phases">>,
  overdueByOwner: Map<string, OverdueOwnerGroup>
) {
  if (earlierPhaseIds.size === 0) return

  for (const status of SCAN_OPEN_STATUSES) {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_root_type_and_root_id_and_status", (q) =>
        q
          .eq("root.type", owner.type)
          .eq("root.id", owner.id)
          .eq("status", status)
      )
      .collect()

    for (const task of tasks) {
      if (task.parent.type !== "phases") continue
      if (!earlierPhaseIds.has(task.parent.id)) continue
      mergeTaskIntoOverdueByOwner(overdueByOwner, task)
    }
  }
}

async function scanCompetitionCarryoverPage(
  ctx: MutationCtx,
  input: {
    cursor: string | null
    overdueByOwner: Map<string, OverdueOwnerGroup>
  }
) {
  const page = await ctx.db.query("competitions").paginate({
    numItems: CARRYOVER_OWNERS_PER_PASS,
    cursor: input.cursor,
  })

  for (const ownerDoc of page.page) {
    const phaseId = ownerDoc.phaseId
    if (phaseId === null) continue

    const owner = { type: "competitions" as const, id: ownerDoc._id }
    const earlierPhaseIds = await earlierPhaseIdsForOwner(
      ctx,
      owner,
      phaseId
    )
    await scanCarryoverTasksForOwner(
      ctx,
      owner,
      earlierPhaseIds,
      input.overdueByOwner
    )
  }

  return page
}

async function scanProjectCarryoverPage(
  ctx: MutationCtx,
  input: {
    cursor: string | null
    overdueByOwner: Map<string, OverdueOwnerGroup>
  }
) {
  const page = await ctx.db.query("projects").paginate({
    numItems: CARRYOVER_OWNERS_PER_PASS,
    cursor: input.cursor,
  })

  for (const ownerDoc of page.page) {
    const phaseId = ownerDoc.phaseId
    if (phaseId === null) continue

    const owner = { type: "projects" as const, id: ownerDoc._id }
    const earlierPhaseIds = await earlierPhaseIdsForOwner(
      ctx,
      owner,
      phaseId
    )
    await scanCarryoverTasksForOwner(
      ctx,
      owner,
      earlierPhaseIds,
      input.overdueByOwner
    )
  }

  return page
}

function ownerGroupToRemaining(
  overdueByOwner: Map<string, OverdueOwnerGroup>
): OverdueOwnerGroup[] {
  return [...overdueByOwner.values()]
}

async function scheduleContinueDueScan(
  ctx: MutationCtx,
  input: {
    nowMs: number
    stage: DueScanStage
    dueSoonCursor: string | null
    dateOverdueStatusIndex: number
    dateOverdueCursor: string | null
    carryoverTable: "competitions" | "projects"
    carryoverCursor: string | null
    overdueByOwner: Map<string, OverdueOwnerGroup>
  }
) {
  await ctx.scheduler.runAfter(0, internal.notifications.due._continueDueScan, {
    nowMs: input.nowMs,
    stage: input.stage,
    dueSoonCursor: input.dueSoonCursor,
    dateOverdueStatusIndex: input.dateOverdueStatusIndex,
    dateOverdueCursor: input.dateOverdueCursor,
    carryoverTable: input.carryoverTable,
    carryoverCursor: input.carryoverCursor,
    overdueByOwner: ownerGroupToRemaining(input.overdueByOwner),
  })
}

async function dispatchOverdueBatch(
  ctx: MutationCtx,
  input: {
    today: string
    remaining: OverdueOwnerGroup[]
    summaryEmittedOwnerKeys: string[]
  }
): Promise<{
  remaining: OverdueOwnerGroup[]
  summaryEmittedOwnerKeys: string[]
}> {
  const summaryEmitted = new Set(input.summaryEmittedOwnerKeys)
  const stillRemaining: OverdueOwnerGroup[] = []
  let tasksProcessed = 0

  for (let groupIndex = 0; groupIndex < input.remaining.length; groupIndex++) {
    const group = input.remaining[groupIndex]
    if (tasksProcessed >= DISPATCH_TASK_BUDGET) {
      stillRemaining.push(group)
      continue
    }

    const ownerKey = objectRefKey(group.owner)
    const budgetLeft = DISPATCH_TASK_BUDGET - tasksProcessed

    if (group.taskIds.length > budgetLeft) {
      const batchTaskIds = group.taskIds.slice(0, budgetLeft)
      const restTaskIds = group.taskIds.slice(budgetLeft)

      if (!summaryEmitted.has(ownerKey)) {
        await scheduleNotificationEvent(ctx, {
          kind: "ownerOverdueSummary",
          owner: group.owner,
          today: input.today,
          taskIds: group.taskIds,
        })
        summaryEmitted.add(ownerKey)
      }

      await dispatchOwnerGroupTasks(ctx, {
        today: input.today,
        taskIds: batchTaskIds,
      })
      tasksProcessed += batchTaskIds.length
      stillRemaining.push({ owner: group.owner, taskIds: restTaskIds })
      stillRemaining.push(...input.remaining.slice(groupIndex + 1))
      break
    }

    if (!summaryEmitted.has(ownerKey)) {
      await scheduleNotificationEvent(ctx, {
        kind: "ownerOverdueSummary",
        owner: group.owner,
        today: input.today,
        taskIds: group.taskIds,
      })
      summaryEmitted.add(ownerKey)
    }

    await dispatchOwnerGroupTasks(ctx, {
      today: input.today,
      taskIds: group.taskIds,
    })
    tasksProcessed += group.taskIds.length
  }

  return {
    remaining: stillRemaining,
    summaryEmittedOwnerKeys: [...summaryEmitted],
  }
}

async function startDispatch(
  ctx: MutationCtx,
  input: {
    today: string
    overdueByOwner: Map<string, OverdueOwnerGroup>
  }
) {
  const remaining = ownerGroupToRemaining(input.overdueByOwner)
  if (remaining.length === 0) return

  const batch = await dispatchOverdueBatch(ctx, {
    today: input.today,
    remaining,
    summaryEmittedOwnerKeys: [],
  })
  if (batch.remaining.length === 0) return

  await ctx.scheduler.runAfter(
    0,
    internal.notifications.due._dispatchOverdueBatch,
    {
      today: input.today,
      remaining: batch.remaining,
      summaryEmittedOwnerKeys: batch.summaryEmittedOwnerKeys,
    }
  )
}

interface DueScanPassState {
  nowMs: number
  stage: DueScanStage
  dueSoonCursor: string | null
  dateOverdueStatusIndex: number
  dateOverdueCursor: string | null
  carryoverTable: "competitions" | "projects"
  carryoverCursor: string | null
  tomorrow: string
  today: string
  overdueByOwner: Map<string, OverdueOwnerGroup>
}

async function runDueScanPass(ctx: MutationCtx, input: DueScanPassState) {
  // Convex allows at most one `.paginate()` per mutation — each invocation
  // processes a single page, then schedules `_continueDueScan` to continue.
  if (input.stage === "dueSoon") {
    const dueSoonPage = await scanDueSoonPage(ctx, {
      cursor: input.dueSoonCursor,
      tomorrow: input.tomorrow,
    })
    if (!dueSoonPage.isDone) {
      await scheduleContinueDueScan(ctx, {
        nowMs: input.nowMs,
        stage: "dueSoon",
        dueSoonCursor: dueSoonPage.continueCursor,
        dateOverdueStatusIndex: input.dateOverdueStatusIndex,
        dateOverdueCursor: input.dateOverdueCursor,
        carryoverTable: input.carryoverTable,
        carryoverCursor: input.carryoverCursor,
        overdueByOwner: input.overdueByOwner,
      })
      return
    }

    await scheduleContinueDueScan(ctx, {
      nowMs: input.nowMs,
      stage: "dateOverdue",
      dueSoonCursor: null,
      dateOverdueStatusIndex: 0,
      dateOverdueCursor: null,
      carryoverTable: "competitions",
      carryoverCursor: null,
      overdueByOwner: input.overdueByOwner,
    })
    return
  }

  if (input.stage === "dateOverdue") {
    if (input.dateOverdueStatusIndex >= SCAN_OPEN_STATUSES.length) {
      await scheduleContinueDueScan(ctx, {
        nowMs: input.nowMs,
        stage: "phaseCarryover",
        dueSoonCursor: null,
        dateOverdueStatusIndex: 0,
        dateOverdueCursor: null,
        carryoverTable: "competitions",
        carryoverCursor: null,
        overdueByOwner: input.overdueByOwner,
      })
      return
    }

    const status = SCAN_OPEN_STATUSES[input.dateOverdueStatusIndex]
    const dateOverduePage = await scanDateOverduePage(ctx, {
      today: input.today,
      status,
      cursor: input.dateOverdueCursor,
      overdueByOwner: input.overdueByOwner,
    })

    if (!dateOverduePage.isDone) {
      await scheduleContinueDueScan(ctx, {
        nowMs: input.nowMs,
        stage: "dateOverdue",
        dueSoonCursor: null,
        dateOverdueStatusIndex: input.dateOverdueStatusIndex,
        dateOverdueCursor: dateOverduePage.continueCursor,
        carryoverTable: input.carryoverTable,
        carryoverCursor: input.carryoverCursor,
        overdueByOwner: input.overdueByOwner,
      })
      return
    }

    await scheduleContinueDueScan(ctx, {
      nowMs: input.nowMs,
      stage: "dateOverdue",
      dueSoonCursor: null,
      dateOverdueStatusIndex: input.dateOverdueStatusIndex + 1,
      dateOverdueCursor: null,
      carryoverTable: input.carryoverTable,
      carryoverCursor: input.carryoverCursor,
      overdueByOwner: input.overdueByOwner,
    })
    return
  }

  const carryoverPage =
    input.carryoverTable === "competitions"
      ? await scanCompetitionCarryoverPage(ctx, {
          cursor: input.carryoverCursor,
          overdueByOwner: input.overdueByOwner,
        })
      : await scanProjectCarryoverPage(ctx, {
          cursor: input.carryoverCursor,
          overdueByOwner: input.overdueByOwner,
        })

  if (!carryoverPage.isDone) {
    await scheduleContinueDueScan(ctx, {
      nowMs: input.nowMs,
      stage: "phaseCarryover",
      dueSoonCursor: null,
      dateOverdueStatusIndex: SCAN_OPEN_STATUSES.length,
      dateOverdueCursor: null,
      carryoverTable: input.carryoverTable,
      carryoverCursor: carryoverPage.continueCursor,
      overdueByOwner: input.overdueByOwner,
    })
    return
  }

  if (input.carryoverTable === "competitions") {
    await scheduleContinueDueScan(ctx, {
      nowMs: input.nowMs,
      stage: "phaseCarryover",
      dueSoonCursor: null,
      dateOverdueStatusIndex: SCAN_OPEN_STATUSES.length,
      dateOverdueCursor: null,
      carryoverTable: "projects",
      carryoverCursor: null,
      overdueByOwner: input.overdueByOwner,
    })
    return
  }

  await startDispatch(ctx, {
    today: input.today,
    overdueByOwner: input.overdueByOwner,
  })
}

async function continueDueScan(
  ctx: MutationCtx,
  input: {
    nowMs: number
    stage: DueScanStage
    dueSoonCursor: string | null
    dateOverdueStatusIndex: number
    dateOverdueCursor: string | null
    carryoverTable: "competitions" | "projects"
    carryoverCursor: string | null
    overdueByOwner: OverdueOwnerGroup[]
  }
) {
  if (!isDublinLocalHour(8, input.nowMs)) return null

  const today = dublinToday(input.nowMs)
  const tomorrow = dublinDateOffset(today, 1)
  const overdueByOwner = new Map(
    input.overdueByOwner.map((entry) => [objectRefKey(entry.owner), entry])
  )

  await runDueScanPass(ctx, {
    nowMs: input.nowMs,
    stage: input.stage,
    dueSoonCursor: input.dueSoonCursor,
    dateOverdueStatusIndex: input.dateOverdueStatusIndex,
    dateOverdueCursor: input.dateOverdueCursor,
    carryoverTable: input.carryoverTable,
    carryoverCursor: input.carryoverCursor,
    tomorrow,
    today,
    overdueByOwner,
  })
  return null
}

async function dispatchOwnerGroupTasks(
  ctx: MutationCtx,
  input: {
    today: string
    taskIds: Id<"tasks">[]
  }
) {
  for (const taskId of input.taskIds) {
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

export const _dispatchOverdueBatch = internalMutation({
  args: {
    today: v.string(),
    remaining: overdueByOwnerValidator,
    summaryEmittedOwnerKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const batch = await dispatchOverdueBatch(ctx, args)
    if (batch.remaining.length === 0) return

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.due._dispatchOverdueBatch,
      {
        today: args.today,
        remaining: batch.remaining,
        summaryEmittedOwnerKeys: batch.summaryEmittedOwnerKeys,
      }
    )
  },
})

export const runDueScan = internalMutation({
  args: { nowMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now()
    return await continueDueScan(ctx, {
      nowMs,
      stage: "dueSoon",
      dueSoonCursor: null,
      dateOverdueStatusIndex: 0,
      dateOverdueCursor: null,
      carryoverTable: "competitions",
      carryoverCursor: null,
      overdueByOwner: [],
    })
  },
})

const dueScanStageValidator = v.union(
  v.literal("dueSoon"),
  v.literal("dateOverdue"),
  v.literal("phaseCarryover")
)

export const _continueDueScan = internalMutation({
  args: {
    nowMs: v.number(),
    stage: dueScanStageValidator,
    dueSoonCursor: v.union(v.string(), v.null()),
    dateOverdueStatusIndex: v.number(),
    dateOverdueCursor: v.union(v.string(), v.null()),
    carryoverTable: v.union(v.literal("competitions"), v.literal("projects")),
    carryoverCursor: v.union(v.string(), v.null()),
    overdueByOwner: overdueByOwnerValidator,
  },
  handler: async (ctx, args) => continueDueScan(ctx, args),
})
