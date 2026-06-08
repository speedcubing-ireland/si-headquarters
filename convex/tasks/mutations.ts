import { mutation } from "@/convex/_generated/server"
import {
  assignTaskAndNotify,
  resetTaskDueNoticeState,
  scheduleTaskStatusNotifications,
} from "@/convex/notifications/events"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { taskKindType } from "@/convex/tasks/kind"
import {
  taskStatusCommandType,
  taskStatusType,
} from "@/convex/tasks/status/validators"
import {
  assigneesType,
  taskOwnerRef,
  taskParentRef,
} from "@/convex/tasks/validators"
import { isClaimableAssigneeIds } from "@/convex/tasks/assignees"
import {
  activatePhaseBacklogTasks,
  reopenTaskStatus,
  requestTaskStatusChange,
  recomputeRelatedTaskStatuses,
  setTaskKindAndRecompute,
  setTaskOrderAndRecompute,
} from "@/convex/tasks/status/recompute"
import { requireTaskManagement } from "@/convex/permissions/principal"
import { v } from "convex/values"
import { generateKeyBetween } from "fractional-indexing"

async function getNextTaskOrder(
  ctx: MutationCtx,
  parent:
    | { type: "phases"; id: Id<"phases"> }
    | { type: "tasks"; id: Id<"tasks"> }
) {
  const siblings =
    parent.type === "phases"
      ? await ctx.db
          .query("tasks")
          .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
            q.eq("parent.type", "phases").eq("parent.id", parent.id)
          )
          .order("desc")
          .take(1)
      : await ctx.db
          .query("tasks")
          .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
            q.eq("parent.type", "tasks").eq("parent.id", parent.id)
          )
          .order("desc")
          .take(1)

  if (siblings.length === 0) return generateKeyBetween(null, null)

  const previousOrder = siblings[0].order
  try {
    return generateKeyBetween(previousOrder, null)
  } catch {
    return `${previousOrder}0`
  }
}

async function requireExistingTaskParent(
  ctx: MutationCtx,
  parent:
    | { type: "phases"; id: Id<"phases"> }
    | { type: "tasks"; id: Id<"tasks"> }
) {
  const parentDoc =
    parent.type === "phases"
      ? await ctx.db.get("phases", parent.id)
      : await ctx.db.get("tasks", parent.id)

  if (parentDoc === null) {
    throw new Error("Task parent not found")
  }
}

async function requireExistingLabels(
  ctx: MutationCtx,
  labelIds: Id<"taskLabels">[]
) {
  for (const labelId of labelIds) {
    const label = await ctx.db.get("taskLabels", labelId)
    if (label === null) {
      throw new Error("Task label not found")
    }
  }
}

export const createTask = mutation({
  args: {
    name: v.string(),
    description: v.nullable(v.string()),
    parent: taskParentRef,
    initialStatus: v.optional(taskStatusType),
    assigneeIds: assigneesType,
    owner: taskOwnerRef,
    dueDate: v.nullable(v.string()),
    labelIds: v.array(v.id("taskLabels")),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)
    const name = args.name.trim()
    if (name.length === 0) throw new Error("Task name is required")

    await requireExistingTaskParent(ctx, args.parent)
    const labelIds = Array.from(new Set(args.labelIds))
    await requireExistingLabels(ctx, labelIds)
    const assigneeIds = Array.isArray(args.assigneeIds)
      ? Array.from(new Set(args.assigneeIds))
      : args.assigneeIds

    const descTrim = args.description?.trim()
    const description =
      descTrim !== undefined && descTrim.length > 0 ? descTrim : null
    const status = args.initialStatus ?? "backlog"
    const taskId = await ctx.db.insert("tasks", {
      name,
      description,
      parent: args.parent,
      order: await getNextTaskOrder(ctx, args.parent),
      assigneeIds: null,
      owner: args.owner,
      dueDate: args.dueDate,
      kind: "standard",
      status,
      statusIntent: { type: "manual", status },
    })

    if (assigneeIds !== null) {
      await assignTaskAndNotify(ctx, {
        taskId,
        actorId: principal.userId,
        assigneeIds,
      })
    }

    for (const labelId of labelIds) {
      await ctx.db.insert("taskLabelAssignments", {
        taskId,
        labelId,
      })
    }

    await scheduleTaskStatusNotifications(
      ctx,
      await recomputeRelatedTaskStatuses(ctx, taskId),
      principal.userId
    )

    return taskId
  },
})

export const setTaskDetails = mutation({
  args: {
    id: v.id("tasks"),
    name: v.string(),
    description: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTaskManagement(ctx)
    const name = args.name.trim()
    if (name.length === 0) throw new Error("Task name is required")

    const descTrim = args.description?.trim()
    const description =
      descTrim !== undefined && descTrim.length > 0 ? descTrim : null

    await ctx.db.patch("tasks", args.id, { name, description })
  },
})

export const setTaskStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: taskStatusCommandType,
  },
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)
    const result = await requestTaskStatusChange(ctx, args.id, args.status)
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
  },
})

export const reopenTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)
    const result = await reopenTaskStatus(ctx, args.id)
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
  },
})

export const setTaskKind = mutation({
  args: {
    id: v.id("tasks"),
    kind: taskKindType,
  },
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)
    const result = await setTaskKindAndRecompute(ctx, args.id, args.kind)
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
  },
})

export const setTaskOrder = mutation({
  args: {
    id: v.id("tasks"),
    order: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)
    const result = await setTaskOrderAndRecompute(ctx, args.id, args.order)
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
  },
})

export const activatePhaseTasks = mutation({
  args: {
    phaseId: v.id("phases"),
  },
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)
    const result = await activatePhaseBacklogTasks(ctx, args.phaseId)
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
    return null
  },
})

export const setTaskDueDate = mutation({
  args: {
    id: v.id("tasks"),
    dueDate: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTaskManagement(ctx)
    const task = await ctx.db.get("tasks", args.id)
    const previousDueDate = task?.dueDate ?? null
    await ctx.db.patch("tasks", args.id, { dueDate: args.dueDate })
    if (previousDueDate !== args.dueDate) {
      await resetTaskDueNoticeState(ctx, args.id)
    }
  },
})

export const setTaskAssignees = mutation({
  args: {
    id: v.id("tasks"),
    assigneeIds: assigneesType,
  },
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)
    const nextAssigneeIds = Array.isArray(args.assigneeIds)
      ? Array.from(new Set(args.assigneeIds))
      : args.assigneeIds

    await assignTaskAndNotify(ctx, {
      taskId: args.id,
      actorId: principal.userId,
      assigneeIds: nextAssigneeIds,
    })
  },
})

export const claimTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)
    const task = await ctx.db.get("tasks", args.id)
    if (task === null) throw new Error("Task not found")
    if (!isClaimableAssigneeIds(task.assigneeIds)) {
      throw new Error("Task is already assigned")
    }
    await assignTaskAndNotify(ctx, {
      taskId: args.id,
      actorId: principal.userId,
      assigneeIds: [principal.userId],
    })
  },
})

export const setTaskOwner = mutation({
  args: {
    id: v.id("tasks"),
    owner: taskOwnerRef,
  },
  handler: async (ctx, args) => {
    await requireTaskManagement(ctx)
    await ctx.db.patch("tasks", args.id, { owner: args.owner })
  },
})

export const setTaskLabels = mutation({
  args: {
    id: v.id("tasks"),
    labelIds: v.array(v.id("taskLabels")),
  },
  handler: async (ctx, args) => {
    await requireTaskManagement(ctx)
    const labelIds = new Set(args.labelIds)
    const existingAssignments = await ctx.db
      .query("taskLabelAssignments")
      .withIndex("by_taskId_and_labelId", (q) => q.eq("taskId", args.id))
      .collect()

    const existingLabelIds = new Set(
      existingAssignments.map((assignment) => assignment.labelId)
    )

    const deletePromises = existingAssignments
      .filter((assignment) => !labelIds.has(assignment.labelId))
      .map((assignment) =>
        ctx.db.delete("taskLabelAssignments", assignment._id)
      )

    const insertPromises = []
    for (const labelId of labelIds) {
      if (existingLabelIds.has(labelId)) continue
      insertPromises.push(
        ctx.db.insert("taskLabelAssignments", {
          taskId: args.id,
          labelId,
        })
      )
    }

    await Promise.all([...insertPromises, ...deletePromises])
  },
})
