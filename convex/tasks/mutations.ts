import { mutation } from "@/convex/_generated/server"
import { taskOwnerRef, taskStatusType } from "@/convex/tasks/validators"
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

    const description = args.description?.trim()

    await ctx.db.patch(args.id, {
      name,
      description: description && description.length > 0 ? description : null,
    })
  },
})

export const setTaskStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: taskStatusType,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status })
  },
})

export const setTaskDueDate = mutation({
  args: {
    id: v.id("tasks"),
    dueDate: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("tasks", args.id, {
      dueDate: args.dueDate,
    })
    return
  },
})

export const setTaskAssignees = mutation({
  args: {
    id: v.id("tasks"),
    assigneeIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const assigneeIds = [...new Set(args.assigneeIds)]
    await ctx.db.patch(args.id, {
      assigneeIds: assigneeIds.length > 0 ? assigneeIds : null,
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
    const labelIds = [...new Set(args.labelIds)]

    const existingAssignments = await ctx.db
      .query("taskLabelAssignments")
      .withIndex("by_taskId_and_labelId", (q) => q.eq("taskId", args.id))
      .collect()

    const nextLabelIds = new Set(labelIds)
    const existingLabelIds = new Set(
      existingAssignments.map((assignment) => assignment.labelId)
    )

    const deletePromises = existingAssignments
      .filter((assignment) => !nextLabelIds.has(assignment.labelId))
      .map((assignment) => ctx.db.delete(assignment._id))

    await Promise.all(deletePromises)

    const insertPromises = []
    for (const labelId of nextLabelIds) {
      if (existingLabelIds.has(labelId)) continue
      insertPromises.push(
        ctx.db.insert("taskLabelAssignments", {
          taskId: args.id,
          labelId,
        })
      )
    }
    await Promise.all(insertPromises)
  },
})
