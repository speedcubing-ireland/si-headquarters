import { mutation } from "@/convex/_generated/server"
import { taskKindType } from "@/convex/tasks/kind"
import { taskStatusCommandType } from "@/convex/tasks/status/validators"
import { taskOwnerRef } from "@/convex/tasks/validators"
import {
  activatePhaseBacklogTasks,
  reopenTaskStatus,
  requestTaskStatusChange,
  setTaskKindAndRecompute,
  setTaskOrderAndRecompute,
} from "@/convex/tasks/status/recompute"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

export const setTaskDetails = mutation({
  args: {
    id: v.id("tasks"),
    name: v.string(),
    description: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim()
    if (!name || name.length === 0) throw new Error("Task name is required")

    const descTrim = args.description?.trim()
    const description = descTrim && descTrim.length > 0 ? descTrim : null

    await ctx.db.patch(args.id, {
      name,
      description,
    })
  },
})

export const setTaskStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: taskStatusCommandType,
  },
  handler: async (ctx, args) => {
    await requestTaskStatusChange(ctx, args.id, args.status)
  },
})

export const reopenTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await reopenTaskStatus(ctx, args.id)
  },
})

export const setTaskKind = mutation({
  args: {
    id: v.id("tasks"),
    kind: taskKindType,
  },
  handler: async (ctx, args) => {
    await setTaskKindAndRecompute(ctx, args.id, args.kind)
  },
})

export const setTaskOrder = mutation({
  args: {
    id: v.id("tasks"),
    order: v.string(),
  },
  handler: async (ctx, args) => {
    await setTaskOrderAndRecompute(ctx, args.id, args.order)
  },
})

export const activatePhaseTasks = mutation({
  args: {
    phaseId: v.id("phases"),
  },
  handler: async (ctx, args) => {
    await activatePhaseBacklogTasks(ctx, args.phaseId)
  },
})

export const setTaskDueDate = mutation({
  args: {
    id: v.id("tasks"),
    dueDate: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      dueDate: args.dueDate,
    })
  },
})

export const setTaskAssignees = mutation({
  args: {
    id: v.id("tasks"),
    assigneeIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const assigneeIds = new Set(args.assigneeIds)
    await ctx.db.patch(args.id, {
      assigneeIds: assigneeIds.size > 0 ? Array.from(assigneeIds) : null,
    })
  },
})

export const claimTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Authentication required")

    await ctx.db.patch(args.id, { assigneeIds: [userId] })
  },
})

export const setTaskOwner = mutation({
  args: {
    id: v.id("tasks"),
    owner: taskOwnerRef,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { owner: args.owner })
  },
})

export const setTaskLabels = mutation({
  args: {
    id: v.id("tasks"),
    labelIds: v.array(v.id("taskLabels")),
  },
  handler: async (ctx, args) => {
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
      .map((assignment) => ctx.db.delete(assignment._id))

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
