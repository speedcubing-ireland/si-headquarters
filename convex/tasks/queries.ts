// To-do some of these if not used eventually should be removed

import { query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { requireTaskManagement } from "@/convex/permissions/principal"
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
import { taskKindType } from "@/convex/tasks/kind"
import { phaseColor } from "@/convex/phases/validators"
import { taskParentRef } from "@/convex/tasks/validators"
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

type TaskCreationScope =
  | { type: "competitions"; id: Id<"competitions"> }
  | { type: "tasks"; id: Id<"tasks"> }

const taskCreationPhaseTarget = v.object({
  _id: v.id("phases"),
  name: v.string(),
  color: phaseColor,
  competitionId: v.id("competitions"),
  competitionName: v.string(),
})

const taskCreationTaskTarget = v.object({
  _id: v.id("tasks"),
  name: v.string(),
  kind: taskKindType,
  pathLabel: v.string(),
  contextLabel: v.string(),
})

const CREATION_TARGET_DEFAULT_LIMIT = 50
const CREATION_TARGET_MAX_ANCESTOR_READS = 200

function getTaskCreationPath(
  task: Doc<"tasks">,
  taskById: Map<Id<"tasks">, Doc<"tasks">>
) {
  const names = [task.name]
  let parent = task.parent
  let guard = 0

  while (parent.type === "tasks" && guard < 20) {
    const parentTask = taskById.get(parent.id)
    if (!parentTask) break
    names.unshift(parentTask.name)
    parent = parentTask.parent
    guard += 1
  }

  return {
    phaseId: parent.type === "phases" ? parent.id : null,
    pathLabel: names.join(" / "),
  }
}

function getTaskCreationContext(
  phaseId: Id<"phases"> | null,
  phaseById: Map<Id<"phases">, Doc<"phases">>,
  competitionById: Map<Id<"competitions">, Doc<"competitions">>
) {
  if (phaseId === null) return "No competition context"

  const phase = phaseById.get(phaseId)
  const competition =
    phase !== undefined ? competitionById.get(phase.owner.id) : undefined
  return [competition?.name, phase?.name].filter(Boolean).join(" / ")
}

function appendUniqueDoc<T extends { _id: string }>(docs: T[], doc: T | null) {
  if (doc === null || docs.some((entry) => entry._id === doc._id)) return docs
  return [...docs, doc]
}

async function listTaskCreationCompetitionPhaseDocs(
  ctx: QueryCtx,
  competitionId: Id<"competitions">
) {
  return await ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", "competitions").eq("owner.id", competitionId)
    )
    .order("asc")
    .take(CREATION_TARGET_DEFAULT_LIMIT + 1)
}

async function loadTasksByIds(ctx: QueryCtx, ids: Iterable<Id<"tasks">>) {
  const uniqueIds = [...new Set(ids)]
  const tasks = await Promise.all(
    uniqueIds.map((taskId) => ctx.db.get("tasks", taskId))
  )

  return tasks.filter((task): task is Doc<"tasks"> => task !== null)
}

async function listScopedTaskCreationDocs(
  ctx: QueryCtx,
  scope: TaskCreationScope
) {
  if (scope.type === "competitions") {
    const [phases, view] = await Promise.all([
      listTaskCreationCompetitionPhaseDocs(ctx, scope.id),
      getCompetitionSubtaskView(ctx, scope.id),
    ])
    const taskIds = view.sections.flatMap((section) =>
      section.rows.map((row) => row.task._id)
    )

    return {
      targetPhases: phases,
      targetTasks: await loadTasksByIds(ctx, taskIds),
    }
  }

  const [ownerTask, view] = await Promise.all([
    ctx.db.get("tasks", scope.id),
    getTaskSubtaskView(ctx, scope.id),
  ])
  const taskIds = view.sections.flatMap((section) =>
    section.rows.map((row) => row.task._id)
  )
  const targetTasks = await loadTasksByIds(ctx, taskIds)

  return {
    targetPhases: [],
    targetTasks:
      ownerTask === null
        ? targetTasks
        : appendUniqueDoc(targetTasks, ownerTask),
  }
}

function searchMatches(...values: (string | null | undefined)[]) {
  return (search: string) => {
    if (search.length === 0) return true
    const normalizedSearch = search.toLocaleLowerCase()

    return values.some(
      (value) => value?.toLocaleLowerCase().includes(normalizedSearch) ?? false
    )
  }
}

async function loadTaskCreationAncestors(
  ctx: QueryCtx,
  taskDocs: Doc<"tasks">[]
) {
  const taskById = new Map(taskDocs.map((task) => [task._id, task]))
  let ancestorReadCount = 0

  for (;;) {
    const missingParentIds = new Set<Id<"tasks">>()
    const phaseIds = new Set<Id<"phases">>()

    for (const task of taskById.values()) {
      if (task.parent.type === "tasks" && !taskById.has(task.parent.id)) {
        missingParentIds.add(task.parent.id)
      } else if (task.parent.type === "phases") {
        phaseIds.add(task.parent.id)
      }
    }

    if (missingParentIds.size === 0) {
      return { taskById, phaseIds }
    }

    ancestorReadCount += missingParentIds.size
    if (ancestorReadCount > CREATION_TARGET_MAX_ANCESTOR_READS) {
      throw new Error("Task creation target ancestry is too deep")
    }

    const parentTasks = await Promise.all(
      [...missingParentIds].map((taskId) => ctx.db.get("tasks", taskId))
    )

    let addedParent = false
    for (const parentTask of parentTasks) {
      if (parentTask === null) continue
      taskById.set(parentTask._id, parentTask)
      addedParent = true
    }

    if (!addedParent) {
      return { taskById, phaseIds }
    }
  }
}

async function loadPhaseMap(
  ctx: QueryCtx,
  phaseDocs: Doc<"phases">[],
  phaseIds: Iterable<Id<"phases">>
) {
  const phaseById = new Map(phaseDocs.map((phase) => [phase._id, phase]))
  const missingPhaseIds = [...phaseIds].filter(
    (phaseId) => !phaseById.has(phaseId)
  )
  const missingPhases = await Promise.all(
    missingPhaseIds.map((phaseId) => ctx.db.get("phases", phaseId))
  )

  for (const phase of missingPhases) {
    if (phase !== null) {
      phaseById.set(phase._id, phase)
    }
  }

  return phaseById
}

async function loadCompetitionMap(
  ctx: QueryCtx,
  phases: Iterable<Doc<"phases">>
) {
  const competitionIds = new Set<Id<"competitions">>()
  for (const phase of phases) {
    competitionIds.add(phase.owner.id)
  }

  const competitions = await Promise.all(
    [...competitionIds].map((competitionId) =>
      ctx.db.get("competitions", competitionId)
    )
  )

  return new Map(
    competitions
      .filter(
        (competition): competition is Doc<"competitions"> =>
          competition !== null
      )
      .map((competition) => [competition._id, competition])
  )
}

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
  const rootPhaseComp = await ctx.db.get("competitions", rootPhase.owner.id)
  if (!rootPhaseComp) throw new Error("Comp not found")

  chain.push({
    id: rootPhaseComp._id,
    type: "competitions",
    name: rootPhaseComp.name,
  })

  return chain.reverse()
}

export const listCreationTargets = query({
  args: {
    scope: subtaskViewOwner,
    search: v.optional(v.string()),
    selectedParent: v.optional(v.union(taskParentRef, v.null())),
  },
  returns: v.object({
    phases: v.array(taskCreationPhaseTarget),
    tasks: v.array(taskCreationTaskTarget),
  }),
  handler: async (ctx, args) => {
    await requireTaskManagement(ctx)
    const search = (args.search ?? "").trim()
    const selectedParent = args.selectedParent ?? null
    const scopedTargets = await listScopedTaskCreationDocs(ctx, args.scope)
    const { targetPhases, targetTasks } = scopedTargets

    const { taskById, phaseIds } = await loadTaskCreationAncestors(
      ctx,
      targetTasks
    )
    const phaseById = await loadPhaseMap(ctx, targetPhases, phaseIds)
    const competitionById = await loadCompetitionMap(ctx, phaseById.values())
    const phaseTargets = targetPhases.map((phase) => ({
      _id: phase._id,
      name: phase.name,
      color: phase.color,
      competitionId: phase.owner.id,
      competitionName:
        competitionById.get(phase.owner.id)?.name ?? "Unknown competition",
    }))
    const taskTargets = targetTasks.map((task) => {
      const path = getTaskCreationPath(task, taskById)
      return {
        _id: task._id,
        name: task.name,
        kind: task.kind,
        pathLabel: path.pathLabel,
        contextLabel: getTaskCreationContext(
          path.phaseId,
          phaseById,
          competitionById
        ),
      }
    })

    let filteredPhaseTargets = phaseTargets.filter((phase) =>
      searchMatches(phase.name, phase.competitionName)(search)
    )
    let filteredTaskTargets = taskTargets.filter((task) =>
      searchMatches(task.name, task.pathLabel, task.contextLabel)(search)
    )

    if (selectedParent?.type === "phases") {
      filteredPhaseTargets = appendUniqueDoc(
        filteredPhaseTargets,
        phaseTargets.find((phase) => phase._id === selectedParent.id) ?? null
      )
    } else if (selectedParent?.type === "tasks") {
      filteredTaskTargets = appendUniqueDoc(
        filteredTaskTargets,
        taskTargets.find((task) => task._id === selectedParent.id) ?? null
      )
    }

    return {
      phases: filteredPhaseTargets.sort(
        (left, right) =>
          left.competitionName.localeCompare(right.competitionName) ||
          left.name.localeCompare(right.name)
      ),
      tasks: filteredTaskTargets.sort(
        (left, right) =>
          left.contextLabel.localeCompare(right.contextLabel) ||
          left.pathLabel.localeCompare(right.pathLabel)
      ),
    }
  },
})

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
      breadcrumbs: await getTaskBreadcrumbs(ctx, args.id),
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
