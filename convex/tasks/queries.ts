// To-do some of these if not used eventually should be removed

import { query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import {
  taskFlowDisplay,
  taskFlowStructure,
  taskFlowView,
  type TaskFlowDisplay,
  type TaskFlowStructure,
  type TaskFlowView,
} from "@/convex/tasks/flowView"
import {
  buildTaskStatusView,
  buildTaskStatusViewWithFlowPosition,
  buildSubtasksWithStatusViews,
  getParentTaskId,
  previewFlowReopenForStatusChange as previewStatusChangeFlowReopen,
  TaskStatusLoader,
  type TaskStatusView,
} from "@/convex/tasks/status/resolver"
import { taskStatusCommandType } from "@/convex/tasks/status/validators"
import { getProgress } from "@/convex/tasks/status/rules"
import {
  getCompetitionSubtaskView,
  getTaskSubtaskView,
  subtaskViewOwner,
  taskSubtaskView,
} from "@/convex/tasks/subtaskView"
import {
  createTaskViewDisplayReader,
  getCurrentEditableStepIndex,
  toTaskViewStatusView,
} from "@/convex/tasks/view"
import { v } from "convex/values"

type TaskParentDetails =
  | {
      type: "tasks"
      _id: Id<"tasks">
      name: string
      kind: Doc<"tasks">["kind"]
      progress: TaskStatusView["progress"]
    }
  | {
      type: "phases"
      _id: Id<"phases">
      name: string
      color: Doc<"phases">["color"]
      competition: {
        _id: Id<"competitions">
        name: string
      }
    }
  | null

export {
  flowViewTaskDetails,
  taskFlowDisplay,
  taskFlowStructure,
  taskFlowView,
  type FlowViewProgress,
  type TaskFlowDisplay,
  type TaskFlowStructure,
  type TaskFlowView,
  type TaskFlowViewTaskDetails,
} from "@/convex/tasks/flowView"

export { type TaskViewProgress } from "@/convex/tasks/view"

export {
  subtaskViewOwner,
  taskSubtaskView,
  type SubtaskViewOwner,
  type TaskSubtaskView,
} from "@/convex/tasks/subtaskView"

async function getTaskFlowStructure(
  task: Doc<"tasks">,
  statusLoader: TaskStatusLoader
): Promise<TaskFlowStructure> {
  const subtasks = await statusLoader.getDirectSubtasks(task._id)
  const stepsWithStatusViews = await buildSubtasksWithStatusViews(
    statusLoader,
    task,
    subtasks
  )
  const currentStepIndex = getCurrentEditableStepIndex(stepsWithStatusViews)

  return {
    parent: {
      taskId: task._id,
      currentStepId:
        currentStepIndex === null
          ? null
          : stepsWithStatusViews[currentStepIndex].task._id,
      currentStepIndex,
      totalSteps: stepsWithStatusViews.length,
    },
    steps: stepsWithStatusViews.map(({ task, statusView }) => ({
      task: {
        _id: task._id,
        name: task.name,
        order: task.order,
        kind: task.kind,
        status: task.status,
        statusIntent: task.statusIntent,
      },
      statusView: toTaskViewStatusView(statusView),
    })),
  }
}

async function getTaskFlowDisplay(
  task: Doc<"tasks">,
  statusLoader: TaskStatusLoader,
  displayReader: ReturnType<typeof createTaskViewDisplayReader>
): Promise<TaskFlowDisplay> {
  const subtasks = await statusLoader.getDirectSubtasks(task._id)
  const steps = await Promise.all(
    subtasks.map((subtask) => displayReader.hydrateTaskDisplay(subtask))
  )

  return { steps }
}

async function getTaskFlowView(
  task: Doc<"tasks">,
  statusLoader: TaskStatusLoader,
  displayReader: ReturnType<typeof createTaskViewDisplayReader>
): Promise<TaskFlowView> {
  const subtasks = await statusLoader.getDirectSubtasks(task._id)
  const stepsWithStatusViews = await buildSubtasksWithStatusViews(
    statusLoader,
    task,
    subtasks
  )
  const currentStepIndex = getCurrentEditableStepIndex(stepsWithStatusViews)

  const steps = await Promise.all(
    stepsWithStatusViews.map((step) => displayReader.hydrateTaskDetails(step))
  )

  return {
    parent: {
      taskId: task._id,
      currentStepId:
        currentStepIndex === null
          ? null
          : stepsWithStatusViews[currentStepIndex].task._id,
      currentStepIndex,
      totalSteps: stepsWithStatusViews.length,
    },
    steps,
  }
}

async function getTaskParentDetails(
  ctx: QueryCtx,
  loader: TaskStatusLoader,
  task: Doc<"tasks">
): Promise<TaskParentDetails> {
  const parentTaskId = getParentTaskId(task)
  if (!parentTaskId) {
    if (task.parent.type === "phases") {
      const phase = await ctx.db.get("phases", task.parent.id)
      if (!phase) return null

      const competition = await ctx.db.get("competitions", phase.owner.id)
      return competition
        ? {
            type: "phases",
            _id: phase._id,
            name: phase.name,
            color: phase.color,
            competition: {
              _id: competition._id,
              name: competition.name,
            },
          }
        : null
    }

    return null
  }

  const parentTask = await loader.getTask(parentTaskId)
  if (!parentTask) return null

  const parentSubtasks = await loader.getDirectSubtasks(parentTask._id)

  return {
    type: "tasks",
    _id: parentTask._id,
    name: parentTask.name,
    kind: parentTask.kind,
    progress: getProgress(parentSubtasks.map((subtask) => subtask.status)),
  }
}

export const getPageRoot = query({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.id)
    if (!task) return null

    return {
      taskId: task._id,
      kind: task.kind,
    }
  },
})

export const getDetails = query({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.id)
    if (!task) throw new Error("Task not found")
    const statusLoader = new TaskStatusLoader(ctx)

    return {
      task,
      parent: await getTaskParentDetails(ctx, statusLoader, task),
    }
  },
})

export const getProperties = query({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.id)
    if (!task) throw new Error("Task not found")
    const displayReader = createTaskViewDisplayReader(ctx)
    const statusLoader = new TaskStatusLoader(ctx)

    const [labels, owner, assignees, statusView] = await Promise.all([
      displayReader.getLabels(task._id),
      displayReader.getOwner(task.owner),
      displayReader.getAssigneeUsers(task.assigneeIds),
      buildTaskStatusViewWithFlowPosition(statusLoader, task),
    ])

    return {
      task,
      labels,
      owner,
      assignees,
      statusView,
    }
  },
})

export const getStatusView = query({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.id)
    if (!task) throw new Error("Task not found")

    const statusLoader = new TaskStatusLoader(ctx)
    return await buildTaskStatusViewWithFlowPosition(statusLoader, task)
  },
})

export const getFlowView = query({
  args: {
    id: v.id("tasks"),
  },
  returns: taskFlowView,
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.id)
    if (!task) throw new Error("Task not found")
    if (task.kind !== "flow") throw new Error("Task is not a flow")

    const statusLoader = new TaskStatusLoader(ctx)
    const displayReader = createTaskViewDisplayReader(ctx)
    return await getTaskFlowView(task, statusLoader, displayReader)
  },
})

export const getFlowStructure = query({
  args: {
    id: v.id("tasks"),
  },
  returns: taskFlowStructure,
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.id)
    if (!task) throw new Error("Task not found")
    if (task.kind !== "flow") throw new Error("Task is not a flow")

    const statusLoader = new TaskStatusLoader(ctx)
    return await getTaskFlowStructure(task, statusLoader)
  },
})

export const getFlowDisplay = query({
  args: {
    id: v.id("tasks"),
  },
  returns: taskFlowDisplay,
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.id)
    if (!task) throw new Error("Task not found")
    if (task.kind !== "flow") throw new Error("Task is not a flow")

    const statusLoader = new TaskStatusLoader(ctx)
    const displayReader = createTaskViewDisplayReader(ctx)
    return await getTaskFlowDisplay(task, statusLoader, displayReader)
  },
})

export const getSubtaskView = query({
  args: {
    owner: subtaskViewOwner,
  },
  returns: taskSubtaskView,
  handler: async (ctx, args) => {
    if (args.owner.type === "tasks") {
      return await getTaskSubtaskView(ctx, args.owner.id)
    }

    return await getCompetitionSubtaskView(ctx, args.owner.id)
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
    const task = await ctx.db.get("tasks", args.id)
    if (!task) throw new Error("Task not found")

    const statusLoader = new TaskStatusLoader(ctx)
    const subtasks = await statusLoader.getDirectSubtasks(task._id)

    return {
      parent: task,
      parentStatusView: await buildTaskStatusView(statusLoader, task, subtasks),
      subtasks: await buildSubtasksWithStatusViews(
        statusLoader,
        task,
        subtasks
      ),
    }
  },
})
