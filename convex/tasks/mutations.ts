import { mutation } from "@/convex/_generated/server"
import {
  assignTaskAndNotify,
  resetTaskDueNoticeState,
  scheduleTaskStatusNotifications,
} from "@/convex/notifications/events"
import { createChildTaskAndRecompute } from "@/convex/tasks/childTasks"
import { taskKindType } from "@/convex/tasks/kind"
import { reorderChildTasksAndRecompute } from "@/convex/tasks/status/recompute"
import { taskStatusCommandType } from "@/convex/tasks/status/validators"
import { assigneesType, taskOwnerRef, taskParentRef } from "@/convex/tasks/validators"
import { isClaimableAssigneeIds } from "@/convex/tasks/assignees"
import {
  activatePhaseBacklogTasks,
  reopenTaskStatus,
  requestTaskStatusChange,
  setTaskKindAndRecompute,
  setTaskOrderAndRecompute,
} from "@/convex/tasks/status/recompute"
import { requireTaskManagement } from "@/convex/permissions/principal"
import { v } from "convex/values"

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

export const createChildTask = mutation({
  args: {
    parent: taskParentRef,
    name: v.string(),
    description: v.optional(v.nullable(v.string())),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)
    const name = args.name.trim()
    if (name.length === 0) throw new Error("Task name is required")

    const descriptionInput = args.description?.trim()
    const description =
      descriptionInput !== undefined && descriptionInput.length > 0
        ? descriptionInput
        : null

    const { taskId, result } = await createChildTaskAndRecompute(ctx, {
      parent: args.parent,
      name,
      description,
    })
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
    return taskId
  },
})

export const reorderChildTasks = mutation({
  args: {
    parent: taskParentRef,
    orderedTaskIds: v.array(v.id("tasks")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const principal = await requireTaskManagement(ctx)
    const result = await reorderChildTasksAndRecompute(
      ctx,
      args.parent,
      args.orderedTaskIds
    )
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
    return null
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
