// To-do some of these if not used eventually should be removed

import { query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import {
  getDirectSubtasks,
  getSubtasksWithStatusViews,
  getTaskStatusView,
  getTaskStatusViewWithFlowPosition,
  previewFlowReopenForStatusChange as previewStatusChangeFlowReopen,
} from "@/convex/tasks/status/resolver"
import { taskStatusCommandType } from "@/convex/tasks/status/validators"
import { v } from "convex/values"

async function getTaskLabels(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<Doc<"taskLabels">[]> {
  const assignments = await ctx.db
    .query("taskLabelAssignments")
    .withIndex("by_taskId_and_labelId", (q) => q.eq("taskId", taskId))
    .collect()

  const labels = await Promise.all(
    assignments.map((assignment) => ctx.db.get(assignment.labelId))
  )

  return labels.filter((label): label is Doc<"taskLabels"> => label !== null)
}

export const getFirst = query({
  args: {},
  handler: async (ctx) => {
    const task = await ctx.db.query("tasks").first()
    if (!task) throw new Error("No tasks found in the database")

    return {
      task,
      labels: await getTaskLabels(ctx, task._id),
      statusView: await getTaskStatusViewWithFlowPosition(ctx, task),
    }
  },
})

export const getStatusView = query({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id)
    if (!task) throw new Error("Task not found")

    return await getTaskStatusViewWithFlowPosition(ctx, task)
  },
})

export const previewFlowReopenForStatusChange = query({
  args: {
    id: v.id("tasks"),
    status: taskStatusCommandType,
  },
  handler: async (ctx, args) => {
    return await previewStatusChangeFlowReopen(ctx, args.id, args.status)
  },
})

export const listSubtasks = query({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id)
    if (!task) throw new Error("Task not found")

    const subtasks = await getDirectSubtasks(ctx, task._id)

    return {
      parent: task,
      parentStatusView: await getTaskStatusView(ctx, task, subtasks),
      subtasks: await getSubtasksWithStatusViews(ctx, task, subtasks),
    }
  },
})
