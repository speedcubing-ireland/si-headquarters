import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { type TASK_KINDS } from "@/convex/tasks/kind"
import {
  getTaskReviewState,
  type TaskReviewState,
} from "@/convex/tasks/reviews/reviewState"
import {
  assertStandardStatusCommand,
  getCurrentFlowStepIndexFromTasks,
  getFlowChildState,
  getFlowParentStatusOptions,
  getProgress,
  getStandardStatusOptions,
  isBacklogIntent,
  isTerminalComplete,
  resolveFlowEffectiveStatus,
  resolveStandardEffectiveStatus,
  type FlowStepState,
  type TaskProgress,
  type TaskStatus,
  type TaskStatusCommand,
  type TaskStatusIntent,
} from "@/convex/tasks/status/rules"

type StatusReadCtx = QueryCtx | MutationCtx

export type {
  FlowStepState,
  TaskProgress,
  TaskStatus,
  TaskStatusCommand,
  TaskStatusIntent,
} from "@/convex/tasks/status/rules"

export type TaskKind = (typeof TASK_KINDS)[number]
export type TaskStatusAction = "reopen"

export type TaskStatusView = {
  taskId: Id<"tasks">
  kind: TaskKind
  statusIntent: TaskStatusIntent
  effectiveStatus: TaskStatus
  isManuallyEditable: boolean
  statusOptions: TaskStatusCommand[]
  availableActions: TaskStatusAction[]
  progress: TaskProgress
  flow: {
    currentStepId: Id<"tasks"> | null
    currentStepIndex: number | null
    totalSteps: number
  } | null
  review: TaskReviewState
}

export type TaskReopenPreview = {
  willReopenFlowStep: boolean
  taskId: Id<"tasks">
  flowId: Id<"tasks"> | null
  reopenedStepId: Id<"tasks"> | null
}

export type TaskWithStatusView = {
  task: Doc<"tasks">
  statusView: TaskStatusView
}

export type TaskStatusPatch = Partial<
  Pick<Doc<"tasks">, "kind" | "order" | "status" | "statusIntent">
>

type ChildViewBuildOptions = {
  knownTaskId?: Id<"tasks">
  knownDirectSubtasks?: Doc<"tasks">[]
}

const MAX_DIRECT_SUBTASKS = 200
const MAX_PHASE_TASKS = 200

export class TaskStatusLoader {
  private readonly ctx: StatusReadCtx
  private readonly getPendingPatch: (
    taskId: Id<"tasks">
  ) => TaskStatusPatch | undefined

  readonly stats = {
    taskReads: 0,
    childReads: 0,
    phaseTaskReads: 0,
    reviewReads: 0,
  }

  private readonly taskCache = new Map<
    Id<"tasks">,
    Promise<Doc<"tasks"> | null>
  >()
  private readonly childCache = new Map<Id<"tasks">, Promise<Doc<"tasks">[]>>()
  private readonly phaseTaskCache = new Map<
    Id<"phases">,
    Promise<Doc<"tasks">[]>
  >()
  private readonly reviewCache = new Map<
    Id<"tasks">,
    Promise<TaskReviewState>
  >()

  constructor(
    ctx: StatusReadCtx,
    getPendingPatch: (
      taskId: Id<"tasks">
    ) => TaskStatusPatch | undefined = () => undefined
  ) {
    this.ctx = ctx
    this.getPendingPatch = getPendingPatch
  }

  async getTask(taskId: Id<"tasks">): Promise<Doc<"tasks"> | null> {
    const existing = this.taskCache.get(taskId)
    if (existing)
      return applyTaskPatch(await existing, this.getPendingPatch(taskId))

    const taskPromise = this.ctx.db.get(taskId)
    this.taskCache.set(taskId, taskPromise)
    this.stats.taskReads += 1

    return applyTaskPatch(await taskPromise, this.getPendingPatch(taskId))
  }

  async getDirectSubtasks(
    taskId: Id<"tasks">,
    limit = MAX_DIRECT_SUBTASKS
  ): Promise<Doc<"tasks">[]> {
    const existing = this.childCache.get(taskId)
    if (existing) return this.applyPendingAndSort(await existing)

    const subtasksPromise = this.ctx.db
      .query("tasks")
      .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
        q.eq("parent.type", "tasks").eq("parent.id", taskId)
      )
      .order("asc")
      .take(limit + 1)
    this.childCache.set(taskId, subtasksPromise)
    this.stats.childReads += 1

    const subtasks = await subtasksPromise
    if (subtasks.length > limit) {
      throw new Error(`Task has more than ${limit} direct subtasks`)
    }

    return this.applyPendingAndSort(subtasks)
  }

  async getPhaseTasks(phaseId: Id<"phases">): Promise<Doc<"tasks">[]> {
    const existing = this.phaseTaskCache.get(phaseId)
    if (existing) return this.applyPendingAndSort(await existing)

    const tasksPromise = this.ctx.db
      .query("tasks")
      .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
        q.eq("parent.type", "phases").eq("parent.id", phaseId)
      )
      .order("asc")
      .take(MAX_PHASE_TASKS + 1)
    this.phaseTaskCache.set(phaseId, tasksPromise)
    this.stats.phaseTaskReads += 1

    const tasks = await tasksPromise
    if (tasks.length > MAX_PHASE_TASKS) {
      throw new Error(`Phase has more than ${MAX_PHASE_TASKS} direct tasks`)
    }

    return this.applyPendingAndSort(tasks)
  }

  async getReviewState(taskId: Id<"tasks">): Promise<TaskReviewState> {
    const existing = this.reviewCache.get(taskId)
    if (existing) return await existing

    const reviewPromise = getTaskReviewState(this.ctx, taskId)
    this.reviewCache.set(taskId, reviewPromise)
    this.stats.reviewReads += 1

    return await reviewPromise
  }

  private applyPendingAndSort(tasks: Doc<"tasks">[]): Doc<"tasks">[] {
    return tasks
      .map((task) => applyTaskPatchToTask(task, this.getPendingPatch(task._id)))
      .sort(compareTasksByOrder)
  }
}

function applyTaskPatch(
  task: Doc<"tasks"> | null,
  patch: TaskStatusPatch | undefined
): Doc<"tasks"> | null {
  return task && patch ? { ...task, ...patch } : task
}

function applyTaskPatchToTask(
  task: Doc<"tasks">,
  patch: TaskStatusPatch | undefined
): Doc<"tasks"> {
  return patch ? { ...task, ...patch } : task
}

function compareTasksByOrder(a: Doc<"tasks">, b: Doc<"tasks">) {
  const orderCompare = a.order.localeCompare(b.order)
  if (orderCompare !== 0) return orderCompare
  return a._creationTime - b._creationTime
}

export function getParentTaskId(task: Doc<"tasks">): Id<"tasks"> | null {
  return task.parent.type === "tasks" ? (task.parent.id as Id<"tasks">) : null
}

export async function getDirectSubtasks(
  ctx: StatusReadCtx,
  taskId: Id<"tasks">,
  limit = MAX_DIRECT_SUBTASKS
): Promise<Doc<"tasks">[]> {
  return await new TaskStatusLoader(ctx).getDirectSubtasks(taskId, limit)
}

export async function getTaskStatusView(
  ctx: StatusReadCtx,
  task: Doc<"tasks">,
  directSubtasks?: Doc<"tasks">[]
): Promise<TaskStatusView> {
  const loader = new TaskStatusLoader(ctx)
  return await buildTaskStatusView(loader, task, directSubtasks)
}

export async function getTaskStatusViewWithFlowPosition(
  ctx: StatusReadCtx,
  task: Doc<"tasks">,
  directSubtasks?: Doc<"tasks">[]
): Promise<TaskStatusView> {
  const loader = new TaskStatusLoader(ctx)
  return await buildTaskStatusViewWithFlowPosition(loader, task, directSubtasks)
}

export async function getSubtasksWithStatusViews(
  ctx: StatusReadCtx,
  parentTask: Doc<"tasks">,
  directSubtasks?: Doc<"tasks">[]
): Promise<TaskWithStatusView[]> {
  const loader = new TaskStatusLoader(ctx)
  return await buildSubtasksWithStatusViews(loader, parentTask, directSubtasks)
}

export async function previewFlowReopenForTask(
  ctx: StatusReadCtx,
  taskId: Id<"tasks">
): Promise<TaskReopenPreview> {
  const loader = new TaskStatusLoader(ctx)
  const task = await loader.getTask(taskId)
  if (!task) throw new Error("Task not found")
  return await buildFlowReopenPreview(loader, task)
}

export async function previewFlowReopenForStatusChange(
  ctx: StatusReadCtx,
  taskId: Id<"tasks">,
  requestedStatus: TaskStatusCommand
): Promise<TaskReopenPreview> {
  const loader = new TaskStatusLoader(ctx)
  const task = await loader.getTask(taskId)
  if (!task) throw new Error("Task not found")

  const view = await buildTaskStatusViewWithFlowPosition(loader, task)
  if (
    !view.isManuallyEditable ||
    !view.statusOptions.includes(requestedStatus)
  ) {
    throw new Error(`Task status ${requestedStatus} is not available`)
  }

  if (requestedStatus === "auto" || task.kind === "flow") {
    return noFlowReopenPreview(task._id)
  }

  const subtasks = await loader.getDirectSubtasks(task._id)
  const review = await loader.getReviewState(task._id)
  const progress = getProgress(subtasks.map((subtask) => subtask.status))
  assertStandardStatusCommand(requestedStatus, review, progress)

  const nextStatus = resolveStandardEffectiveStatus({
    intent: { type: "manual", status: requestedStatus },
    progress,
    review,
  })
  if (isTerminalComplete(nextStatus)) {
    return noFlowReopenPreview(task._id)
  }

  return await buildFlowReopenPreview(loader, task)
}

export async function buildTaskStatusView(
  loader: TaskStatusLoader,
  task: Doc<"tasks">,
  directSubtasks?: Doc<"tasks">[]
): Promise<TaskStatusView> {
  const subtasks = directSubtasks ?? (await loader.getDirectSubtasks(task._id))
  const review = await loader.getReviewState(task._id)
  const progress = getProgress(subtasks.map((subtask) => subtask.status))

  if (task.kind === "flow" && subtasks.length > 0) {
    return getFlowTaskStatusView(task, review, progress, subtasks)
  }

  return getStandardTaskStatusView(asStandardTask(task), review, progress)
}

export async function buildTaskStatusViewWithFlowPosition(
  loader: TaskStatusLoader,
  task: Doc<"tasks">,
  directSubtasks?: Doc<"tasks">[]
): Promise<TaskStatusView> {
  const view = await buildTaskStatusView(loader, task, directSubtasks)
  const parentTaskId = getParentTaskId(task)
  if (!parentTaskId) return view

  const parentTask = await loader.getTask(parentTaskId)
  if (!parentTask || parentTask.kind !== "flow") return view

  const siblings = await loader.getDirectSubtasks(parentTask._id)
  if (siblings.length === 0) return view

  const siblingViews = await buildChildStatusViews(loader, siblings, {
    knownTaskId: task._id,
    knownDirectSubtasks: directSubtasks,
  })
  const siblingIndex = siblings.findIndex((sibling) => sibling._id === task._id)
  if (siblingIndex === -1) return view

  return applyFlowPositions(parentTask, siblings, siblingViews)[siblingIndex]
    .statusView
}

export async function buildSubtasksWithStatusViews(
  loader: TaskStatusLoader,
  parentTask: Doc<"tasks">,
  directSubtasks?: Doc<"tasks">[]
): Promise<TaskWithStatusView[]> {
  const subtasks =
    directSubtasks ?? (await loader.getDirectSubtasks(parentTask._id))
  const statusViews = await buildChildStatusViews(loader, subtasks)

  if (parentTask.kind !== "flow" || subtasks.length === 0) {
    return subtasks.map((task, index) => ({
      task,
      statusView: statusViews[index],
    }))
  }

  return applyFlowPositions(parentTask, subtasks, statusViews)
}

export function getEffectiveTaskStatus(
  task: Doc<"tasks">,
  review: TaskReviewState,
  progress: TaskProgress,
  directSubtasks: Doc<"tasks">[]
): TaskStatus {
  if (task.kind === "flow" && directSubtasks.length > 0) {
    const currentStepIndex = getCurrentFlowStepIndexFromTasks(directSubtasks)
    return resolveFlowEffectiveStatus({
      currentStep: getTaskAtIndex(directSubtasks, currentStepIndex),
      intent: task.statusIntent,
      review,
    })
  }

  return resolveStandardEffectiveStatus({
    intent: task.statusIntent,
    progress,
    review,
  })
}

function getStandardTaskStatusView(
  task: Doc<"tasks">,
  review: TaskReviewState,
  progress: TaskProgress
): TaskStatusView {
  const statusIntent = task.statusIntent
  const effectiveStatus = resolveStandardEffectiveStatus({
    intent: statusIntent,
    progress,
    review,
  })

  return {
    taskId: task._id,
    kind: task.kind,
    statusIntent,
    effectiveStatus,
    isManuallyEditable: true,
    statusOptions: getStandardStatusOptions({ review, progress }),
    availableActions: isTerminalComplete(effectiveStatus) ? ["reopen"] : [],
    progress,
    flow: null,
    review,
  }
}

function getFlowTaskStatusView(
  task: Doc<"tasks">,
  review: TaskReviewState,
  progress: TaskProgress,
  directSubtasks: Doc<"tasks">[]
): TaskStatusView {
  const statusIntent = task.statusIntent
  const currentStepIndex = getCurrentFlowStepIndexFromTasks(directSubtasks)
  const currentStep = getTaskAtIndex(directSubtasks, currentStepIndex)
  const effectiveStatus = resolveFlowEffectiveStatus({
    currentStep,
    intent: statusIntent,
    review,
  })

  return {
    taskId: task._id,
    kind: "flow",
    statusIntent,
    effectiveStatus,
    isManuallyEditable: true,
    statusOptions: getFlowParentStatusOptions({
      currentStepId: currentStep?._id ?? null,
    }),
    availableActions: [],
    progress,
    flow: {
      currentStepId: currentStep?._id ?? null,
      currentStepIndex,
      totalSteps: directSubtasks.length,
    },
    review,
  }
}

function getCurrentFlowStepIndexFromViews(
  subtaskViews: TaskStatusView[]
): number | null {
  const index = subtaskViews.findIndex(
    (view) => !isTerminalComplete(view.effectiveStatus)
  )

  return index === -1 ? null : index
}

async function buildChildStatusViews(
  loader: TaskStatusLoader,
  tasks: Doc<"tasks">[],
  options: ChildViewBuildOptions = {}
): Promise<TaskStatusView[]> {
  return await Promise.all(
    tasks.map(async (task) =>
      buildTaskStatusView(
        loader,
        task,
        task._id === options.knownTaskId
          ? options.knownDirectSubtasks
          : await loader.getDirectSubtasks(task._id)
      )
    )
  )
}

function applyFlowPositions(
  parentTask: Doc<"tasks">,
  tasks: Doc<"tasks">[],
  statusViews: TaskStatusView[]
): TaskWithStatusView[] {
  const currentIndex = getCurrentFlowStepIndexFromViews(statusViews)
  const parentIsBacklog = isBacklogIntent(parentTask.statusIntent)

  return tasks.map((task, index) => ({
    task,
    statusView: applyFlowChildPosition(
      statusViews[index],
      getFlowChildState({
        status: statusViews[index].effectiveStatus,
        index,
        currentIndex,
      }),
      parentIsBacklog
    ),
  }))
}

function applyFlowChildPosition(
  view: TaskStatusView,
  state: FlowStepState,
  parentIsBacklog: boolean
): TaskStatusView {
  if (state === "complete") {
    return {
      ...view,
      isManuallyEditable: false,
      statusOptions: [],
      availableActions: ["reopen"],
    }
  }

  if (state === "future" || parentIsBacklog) {
    return {
      ...view,
      effectiveStatus: "backlog",
      isManuallyEditable: false,
      statusOptions: [],
      availableActions: [],
    }
  }

  return {
    ...view,
    statusOptions: view.statusOptions.filter((status) => status !== "backlog"),
  }
}

function asStandardTask(task: Doc<"tasks">): Doc<"tasks"> {
  return task.kind === "flow"
    ? ({ ...task, kind: "standard" } as Doc<"tasks">)
    : task
}

function getTaskAtIndex(
  tasks: Doc<"tasks">[],
  index: number | null
): Doc<"tasks"> | null {
  return index === null ? null : tasks[index]
}

export async function buildFlowReopenPreview(
  loader: TaskStatusLoader,
  task: Doc<"tasks">
): Promise<TaskReopenPreview> {
  let currentTask: Doc<"tasks"> | null = task
  const visited = new Set<Id<"tasks">>()

  while (currentTask) {
    if (visited.has(currentTask._id)) {
      throw new Error("Task status preview parent cycle detected")
    }
    visited.add(currentTask._id)

    const parentTaskId = getParentTaskId(currentTask)
    if (!parentTaskId) break

    const parent = await loader.getTask(parentTaskId)
    if (!parent) break

    if (parent.kind === "flow" && isTerminalComplete(currentTask.status)) {
      const siblings = await loader.getDirectSubtasks(parent._id)
      const siblingIndex = siblings.findIndex(
        (sibling) => sibling._id === currentTask?._id
      )
      const currentStepIndex = getCurrentFlowStepIndexFromTasks(siblings)
      if (
        siblingIndex !== -1 &&
        (currentStepIndex === null || siblingIndex < currentStepIndex)
      ) {
        return {
          willReopenFlowStep: true,
          taskId: task._id,
          flowId: parent._id,
          reopenedStepId: currentTask._id,
        }
      }
    }

    currentTask = parent
  }

  return {
    willReopenFlowStep: false,
    taskId: task._id,
    flowId: null,
    reopenedStepId: null,
  }
}

function noFlowReopenPreview(taskId: Id<"tasks">): TaskReopenPreview {
  return {
    willReopenFlowStep: false,
    taskId,
    flowId: null,
    reopenedStepId: null,
  }
}
