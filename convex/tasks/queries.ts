// To-do some of these if not used eventually should be removed

import { query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { TaskBlockersLoader } from "@/convex/tasks/blockers/loader"
import { taskFlowView, type TaskFlowView } from "@/convex/tasks/flowView"
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
  toTaskViewSubtaskSummary,
  type TaskViewSubtaskSummary,
} from "@/convex/tasks/view"
import { v } from "convex/values"

type TaskParentDetails =
  | {
      type: "tasks"
      _id: Id<"tasks">
      name: string
      kind: Doc<"tasks">["kind"]
      progress: TaskStatusView["progress"]
      subtaskSummary: TaskViewSubtaskSummary
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
  taskFlowView,
  type FlowViewProgress,
  type TaskFlowView,
  type TaskFlowViewTaskDetails,
} from "@/convex/tasks/flowView"

export {
  type TaskViewProgress,
  type TaskViewSubtaskSummary,
} from "@/convex/tasks/view"

export {
  subtaskViewOwner,
  taskSubtaskView,
  type SubtaskViewOwner,
  type TaskSubtaskView,
} from "@/convex/tasks/subtaskView"

function createFlowDisplayReader(
  ctx: QueryCtx,
  statusLoader: TaskStatusLoader
) {
  return createTaskViewDisplayReader(ctx, {
    blockersLoader: new TaskBlockersLoader(ctx),
    statusLoader,
  })
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
    stepsWithStatusViews.map(async (step) => {
      const childTaskViews = await buildSubtasksWithStatusViews(
        statusLoader,
        step.task,
        await statusLoader.getDirectSubtasks(step.task._id)
      )
      return displayReader.hydrateTaskDetails({
        ...step,
        directSubtaskViews: childTaskViews,
      })
    })
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
  const parentSubtaskViews = await buildSubtasksWithStatusViews(
    loader,
    parentTask,
    parentSubtasks
  )

  return {
    type: "tasks",
    _id: parentTask._id,
    name: parentTask.name,
    kind: parentTask.kind,
    progress: getProgress(
      parentSubtaskViews.map((view) => view.statusView.effectiveStatus)
    ),
    subtaskSummary: toTaskViewSubtaskSummary(parentSubtaskViews),
  }
}

async function getTaskBreadcrumbs(
   ctx: QueryCtx,
   id: Id<"tasks">
) {
    const task = await ctx.db.get("tasks", id)
    if (!task) return

    const chain: BreadcrumbChain = [
      {
        id: task._id,
        type: "tasks",
        name: task.name,
      },
    ]

    let parent = task.parent
    while (parentIsTask(parent)) {
      const parentDoc = await ctx.db.get("tasks", parent.id)
      if (!parentDoc) throw new Error("Parent not found")
      chain.push({
        id: parentDoc._id,
        type: "tasks",
        name: parentDoc.name,
      })
      parent = parentDoc.parent
    }

    const rootPhase = await ctx.db.get("phases", parent.id)
    if (!rootPhase) throw new Error("Phase not found")
    const rootPhaseComp = await ctx.db.get("competitions", rootPhase.owner.id)
    if (!rootPhaseComp) throw new Error("Comp not found")

    chain.push({
      id: rootPhaseComp._id,
      type: "competitions",
      name: rootPhaseComp.name,
    })

    return chain.reverse()
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
      breadcrumbs: await getTaskBreadcrumbs(ctx, args.id)
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
    const displayReader = createFlowDisplayReader(ctx, statusLoader)
    return await getTaskFlowView(task, statusLoader, displayReader)
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

function parentIsTask(
  parent: Doc<"tasks">["parent"]
): parent is { id: Id<"tasks">; type: "tasks" } {
  return parent.type === "tasks"
}

type BreadcrumbChain = ((
  | {
      id: Id<"tasks">
      type: "tasks"
    }
  | {
      id: Id<"competitions">
      type: "competitions"
    }
) & {
  name: string
})[]
