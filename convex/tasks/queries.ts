import {
  requireScopedObjectForRead,
  requireScopedObjectForUpdate,
} from "@/convex/access/scopedObject"
import { query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { collectAll } from "@/convex/utils"
import { TaskBlockersLoader } from "@/convex/tasks/blockers/loader"
import {
  requireTaskManageAccess,
  requireTaskReadAccess,
} from "@/convex/tasks/access"
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
  getOwnerSubtaskView,
  getTaskSubtaskView,
  listCreationTargetsForScope,
  subtaskViewOwner,
  taskCreationTargets,
  taskSubtaskView,
} from "@/convex/tasks/subtaskView"
import {
  createTaskViewDisplayReader,
  getCurrentEditableStepIndex,
  toTaskViewSubtaskSummary,
  type TaskViewSubtaskSummary,
} from "@/convex/tasks/view"
import { taskParentRef } from "@/convex/tasks/validators"
import { listAllApplicationTeamSummaries } from "@/convex/teams/model"
import { teamSummary } from "@/convex/teams/validators"
import { toPublicUser } from "@/convex/users/queries"
import { publicUserValidator } from "@/convex/users/validators"
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
      } | null
      project: {
        _id: Id<"projects">
        name: string
      } | null
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
  taskCreationTargets,
  type SubtaskViewOwner,
  type TaskSubtaskView,
  type TaskCreationTargets,
  type TaskCreationTargetSection,
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

      if (phase.owner.type === "competitions") {
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
              project: null,
            }
          : null
      }

      const project = await ctx.db.get("projects", phase.owner.id)
      return project
        ? {
            type: "phases",
            _id: phase._id,
            name: phase.name,
            color: phase.color,
            competition: null,
            project: {
              _id: project._id,
              name: project.name,
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

async function getTaskBreadcrumbs(ctx: QueryCtx, id: Id<"tasks">) {
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

  if (rootPhase.owner.type === "competitions") {
    const rootPhaseComp = await ctx.db.get("competitions", rootPhase.owner.id)
    if (!rootPhaseComp) throw new Error("Competition not found")
    chain.push({
      id: rootPhaseComp._id,
      type: "competitions",
      name: rootPhaseComp.name,
    })
  } else {
    const rootPhaseProject = await ctx.db.get("projects", rootPhase.owner.id)
    if (!rootPhaseProject) throw new Error("Project not found")
    chain.push({
      id: rootPhaseProject._id,
      type: "projects",
      name: rootPhaseProject.name,
    })
  }

  return chain.reverse()
}

export const listCreationTargets = query({
  args: {
    scope: subtaskViewOwner,
    search: v.optional(v.string()),
    selectedParent: v.optional(v.union(taskParentRef, v.null())),
  },
  returns: taskCreationTargets,
  handler: async (ctx, args) => {
    return await listCreationTargetsForScope(ctx, args)
  },
})

export const listAssignmentOptions = query({
  args: {
    scope: subtaskViewOwner,
  },
  returns: v.object({
    users: v.array(publicUserValidator),
    teams: v.array(teamSummary),
  }),
  handler: async (ctx, args) => {
    if (args.scope.type === "tasks") {
      await requireTaskManageAccess(ctx, args.scope.id)
    } else {
      await requireScopedObjectForUpdate(ctx, args.scope)
    }

    const [users, teams] = await Promise.all([
      collectAll(ctx, "users"),
      listAllApplicationTeamSummaries(ctx),
    ])

    return {
      users: users.map(toPublicUser),
      teams,
    }
  },
})

export const getPageRoot = query({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { task } = await requireTaskReadAccess(ctx, args.id)

    return {
      taskId: task._id,
      kind: task.kind,
      breadcrumbs: await getTaskBreadcrumbs(ctx, args.id),
    }
  },
})

export const getDetails = query({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { task } = await requireTaskReadAccess(ctx, args.id)
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
    const { task } = await requireTaskReadAccess(ctx, args.id)
    const displayReader = createTaskViewDisplayReader(ctx)
    const statusLoader = new TaskStatusLoader(ctx)

    const [labels, owner, assigneeState, statusView] = await Promise.all([
      displayReader.getLabels(task._id),
      displayReader.getOwner(task.owner),
      displayReader.getAssignees(task.assigneeIds),
      buildTaskStatusViewWithFlowPosition(statusLoader, task),
    ])

    return {
      task,
      labels,
      owner,
      assigneeState,
      statusView,
    }
  },
})

export const getStatusView = query({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { task } = await requireTaskReadAccess(ctx, args.id)

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
    const { task } = await requireTaskReadAccess(ctx, args.id)
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
      await requireTaskReadAccess(ctx, args.owner.id)
      return await getTaskSubtaskView(ctx, args.owner.id)
    }

    await requireScopedObjectForRead(ctx, args.owner)
    return await getOwnerSubtaskView(ctx, args.owner)
  },
})

export const previewFlowReopenForStatusChange = query({
  args: {
    id: v.id("tasks"),
    status: taskStatusCommandType,
  },
  handler: async (ctx, args) => {
    await requireTaskReadAccess(ctx, args.id)
    return await previewStatusChangeFlowReopen(ctx, args.id, args.status)
  },
})

export const listSubtasks = query({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { task } = await requireTaskReadAccess(ctx, args.id)

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
  | {
      id: Id<"projects">
      type: "projects"
    }
) & {
  name: string
})[]
