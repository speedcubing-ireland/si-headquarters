import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  buildFlowReopenPreview,
  getEffectiveTaskStatus,
  getParentTaskId,
  TaskStatusLoader,
  type FlowStepState,
  type TaskStatus,
  type TaskStatusCommand,
  type TaskStatusPatch,
} from "@/convex/tasks/status/resolver"
import {
  assertStandardStatusCommand,
  autoStatusIntent,
  getCurrentFlowStepIndexFromTasks,
  getProgress,
  isBacklogIntent,
  isTerminalComplete,
  manualIntent,
  resolveStandardEffectiveStatus,
  statusIntentEquals,
  type TaskStatusIntent,
} from "@/convex/tasks/status/rules"

interface ParentFlowContext {
  parent: Doc<"tasks">
  state: FlowStepState
}

const MAX_RECOMPUTE_STEPS = 1000
const MAX_RECOMPUTE_PASSES_PER_TASK = 8

export async function requestTaskStatusChange(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  requestedStatus: TaskStatusCommand
) {
  await planTaskStatusMutation(ctx, (planner) =>
    planner.setTaskStatus(taskId, requestedStatus)
  )
}

export async function reopenTaskStatus(ctx: MutationCtx, taskId: Id<"tasks">) {
  await planTaskStatusMutation(ctx, (planner) =>
    planner.reopenTask(taskId, "to-do")
  )
}

export async function activatePhaseBacklogTasks(
  ctx: MutationCtx,
  phaseId: Id<"phases">
) {
  await planTaskStatusMutation(ctx, (planner) => planner.activatePhase(phaseId))
}

export async function setTaskKindAndRecompute(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  kind: Doc<"tasks">["kind"]
) {
  await planTaskStatusMutation(ctx, async (planner) => {
    const task = await planner.getRequiredTask(taskId)
    planner.patchTask(task, {
      kind,
      statusIntent:
        kind === "flow"
          ? flowConversionIntent(task)
          : manualIntent(task.status),
    })
    planner.enqueue(taskId)
  })
}

export async function setTaskOrderAndRecompute(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  order: string
) {
  await planTaskStatusMutation(ctx, async (planner) => {
    const task = await planner.getRequiredTask(taskId)
    planner.patchTask(task, { order })
    planner.enqueue(taskId)
  })
}

export async function recomputeRelatedTaskStatuses(
  ctx: MutationCtx,
  startTaskIds: Id<"tasks">[] | Id<"tasks">
) {
  await planTaskStatusMutation(ctx, async (planner) => {
    for (const taskId of Array.isArray(startTaskIds)
      ? startTaskIds
      : [startTaskIds]) {
      await planner.reopenIfReviewMadeFlowStepIncomplete(taskId)
      planner.enqueue(taskId)
    }
  })
}

async function planTaskStatusMutation(
  ctx: MutationCtx,
  run: (planner: TaskStatusMutationPlanner) => Promise<void>
) {
  const planner = new TaskStatusMutationPlanner(ctx)
  await run(planner)
  await planner.commit()
}

class TaskStatusMutationPlanner {
  private readonly patches = new Map<Id<"tasks">, TaskStatusPatch>()
  private readonly queue: Id<"tasks">[] = []
  private readonly pending = new Set<Id<"tasks">>()
  private readonly passes = new Map<Id<"tasks">, number>()
  private readonly ctx: MutationCtx
  private readonly loader: TaskStatusLoader

  constructor(ctx: MutationCtx) {
    this.ctx = ctx
    this.loader = new TaskStatusLoader(ctx, (taskId) =>
      this.patches.get(taskId)
    )
  }

  async getRequiredTask(taskId: Id<"tasks">): Promise<Doc<"tasks">> {
    const task = await this.loader.getTask(taskId)
    if (!task) throw new Error("Task not found")
    return task
  }

  async setTaskStatus(taskId: Id<"tasks">, requestedStatus: TaskStatusCommand) {
    const task = await this.getRequiredTask(taskId)
    await this.assertEditableFromParentFlow(task, requestedStatus)

    if (task.kind === "flow") {
      await this.setFlowStatus(task, requestedStatus)
      return
    }

    if (requestedStatus === "auto") {
      throw new Error("Only flow tasks can be set to auto")
    }

    await this.setStandardTaskStatus(task, requestedStatus)
  }

  async reopenTask(taskId: Id<"tasks">, reopenedStatus: TaskStatus) {
    const task = await this.getRequiredTask(taskId)
    if (task.kind === "flow") {
      throw new Error("Reopen a specific flow step")
    }
    if (!isTerminalComplete(task.status)) {
      throw new Error("Only completed tasks can be reopened")
    }

    this.patchStatus(task, manualIntent(reopenedStatus), reopenedStatus)

    const parentFlow = await this.getParentFlowContext(task)
    if (parentFlow?.state === "future") {
      throw new Error("Only past completed flow steps can be reopened")
    }
    if (parentFlow && isBacklogIntent(parentFlow.parent.statusIntent)) {
      this.patchStatus(parentFlow.parent, autoStatusIntent(), "to-do")
    }
    if (parentFlow) await this.resumePausedFlowAncestors(parentFlow.parent)

    await this.activateStandardTaskTree(task)
  }

  async reopenIfReviewMadeFlowStepIncomplete(taskId: Id<"tasks">) {
    const task = await this.loader.getTask(taskId)
    if (!task || task.kind === "flow" || !isTerminalComplete(task.status)) {
      return
    }

    const subtasks = await this.loader.getDirectSubtasks(task._id)
    const review = await this.loader.getReviewState(task._id)
    const progress = getProgress(subtasks.map((subtask) => subtask.status))
    const nextStatus = resolveStandardEffectiveStatus({
      intent: task.statusIntent,
      progress,
      review,
    })
    if (isTerminalComplete(nextStatus)) return

    const preview = await buildFlowReopenPreview(this.loader, task)
    if (!preview.willReopenFlowStep) return

    this.patchStatus(task, manualIntent(nextStatus), nextStatus)
  }

  async activatePhase(phaseId: Id<"phases">) {
    const tasks = await this.loader.getPhaseTasks(phaseId)
    for (const task of tasks) {
      if (!isBacklogish(task)) continue
      await this.activateTaskTree(task)
    }
  }

  async normalizeTask(taskId: Id<"tasks">) {
    const task = await this.loader.getTask(taskId)
    if (!task) return

    if (task.kind === "flow") {
      await this.normalizeFlowTask(task)
    } else {
      await this.normalizeStandardTask(task)
    }
  }

  async commit() {
    await this.drainQueue()

    for (const [taskId, patch] of this.patches) {
      if (Object.keys(patch).length === 0) continue
      await this.ctx.db.patch("tasks", taskId, patch)
    }
  }

  enqueue(taskId: Id<"tasks">) {
    if (this.pending.has(taskId)) return

    this.pending.add(taskId)
    this.queue.push(taskId)
  }

  patchTask(task: Doc<"tasks">, patch: TaskStatusPatch) {
    const existingPatch = this.patches.get(task._id) ?? {}
    const effectiveTask = { ...task, ...existingPatch }
    const nextPatch = { ...existingPatch }
    let changed = false

    changed =
      applyPatchValue({
        effectiveValue: effectiveTask.kind,
        persistedValue: task.kind,
        nextValue: patch.kind,
        clearValue: () => delete nextPatch.kind,
        setValue: (value) => (nextPatch.kind = value),
      }) || changed
    changed =
      applyPatchValue({
        effectiveValue: effectiveTask.order,
        persistedValue: task.order,
        nextValue: patch.order,
        clearValue: () => delete nextPatch.order,
        setValue: (value) => (nextPatch.order = value),
      }) || changed
    changed =
      applyPatchValue({
        effectiveValue: effectiveTask.status,
        persistedValue: task.status,
        nextValue: patch.status,
        clearValue: () => delete nextPatch.status,
        setValue: (value) => (nextPatch.status = value),
      }) || changed
    changed =
      applyPatchValue({
        effectiveValue: effectiveTask.statusIntent,
        persistedValue: task.statusIntent,
        nextValue: patch.statusIntent,
        clearValue: () => delete nextPatch.statusIntent,
        setValue: (value) => (nextPatch.statusIntent = value),
        equals: statusIntentEquals,
      }) || changed

    if (!changed) return false

    if (isEmptyPatch(nextPatch)) {
      this.patches.delete(task._id)
    } else {
      this.patches.set(task._id, nextPatch)
    }
    this.enqueue(task._id)
    return true
  }

  private patchStatus(
    task: Doc<"tasks">,
    statusIntent: TaskStatusIntent,
    status: TaskStatus
  ) {
    this.patchTask(task, { statusIntent, status })
  }

  private async assertEditableFromParentFlow(
    task: Doc<"tasks">,
    requestedStatus: TaskStatusCommand
  ) {
    const parentFlow = await this.getParentFlowContext(task)
    if (!parentFlow) return

    if (parentFlow.state === "complete") {
      throw new Error("Use reopen to change a completed flow step")
    }
    if (parentFlow.state === "future") {
      throw new Error("Only the current flow step can be edited")
    }
    if (requestedStatus === "backlog") {
      throw new Error("Set the parent flow to backlog")
    }
    if (isBacklogIntent(parentFlow.parent.statusIntent)) {
      throw new Error("Set the parent flow to auto to start the flow")
    }

    await this.resumePausedFlowAncestors(parentFlow.parent)
  }

  private async drainQueue() {
    let steps = 0

    while (this.queue.length > 0) {
      steps += 1
      if (steps > MAX_RECOMPUTE_STEPS) {
        throw new Error(
          `Task status recompute processed more than ${String(MAX_RECOMPUTE_STEPS)} steps`
        )
      }

      const taskId = this.queue.shift()
      if (!taskId) continue
      this.pending.delete(taskId)
      await this.assertNoParentCycle(taskId)

      const passCount = (this.passes.get(taskId) ?? 0) + 1
      if (passCount > MAX_RECOMPUTE_PASSES_PER_TASK) {
        throw new Error("Task status recompute cycle detected")
      }
      this.passes.set(taskId, passCount)

      await this.normalizeTask(taskId)

      const latestTask = await this.loader.getTask(taskId)
      const parentTaskId = latestTask ? getParentTaskId(latestTask) : null
      if (parentTaskId) {
        this.enqueue(parentTaskId)
      }
    }
  }

  private async assertNoParentCycle(taskId: Id<"tasks">) {
    const visited = new Set<Id<"tasks">>()
    let currentTask: Doc<"tasks"> | null = await this.loader.getTask(taskId)

    while (currentTask) {
      if (visited.has(currentTask._id)) {
        throw new Error("Task status recompute parent cycle detected")
      }
      visited.add(currentTask._id)

      const parentTaskId = getParentTaskId(currentTask)
      currentTask = parentTaskId
        ? await this.loader.getTask(parentTaskId)
        : null
    }
  }

  private async setStandardTaskStatus(
    task: Doc<"tasks">,
    requestedStatus: TaskStatus
  ) {
    const subtasks = await this.loader.getDirectSubtasks(task._id)
    const review = await this.loader.getReviewState(task._id)
    const progress = getProgress(subtasks.map((subtask) => subtask.status))

    assertStandardStatusCommand(requestedStatus, review, progress)

    const intent = manualIntent(requestedStatus)
    const nextStatus = resolveStandardEffectiveStatus({
      intent,
      review,
      progress,
    })

    this.patchStatus(task, intent, nextStatus)

    if (
      isBacklogish(task) &&
      !isBacklogIntent(intent) &&
      !isTerminalComplete(nextStatus)
    ) {
      await this.activateStandardTaskTree(task)
    }
  }

  private async setFlowStatus(
    task: Doc<"tasks">,
    requestedStatus: TaskStatusCommand
  ) {
    if (requestedStatus === "auto") {
      await this.setFlowStatusToAuto(task)
      return
    }

    await this.setFlowStatusManually(task, requestedStatus)
  }

  private async setFlowStatusToAuto(task: Doc<"tasks">) {
    const subtasks = await this.loader.getDirectSubtasks(task._id)
    if (subtasks.length === 0) {
      this.convertEmptyFlowToStandard(task)
      return
    }

    this.patchStatus(
      task,
      autoStatusIntent(),
      task.status === "backlog" ? "to-do" : task.status
    )
  }

  private async setFlowStatusManually(
    task: Doc<"tasks">,
    requestedStatus: TaskStatus
  ) {
    const subtasks = await this.loader.getDirectSubtasks(task._id)
    if (subtasks.length === 0) {
      const standardTask = this.convertEmptyFlowToStandard(task)
      await this.setStandardTaskStatus(standardTask, requestedStatus)
      return
    }

    if (requestedStatus === "cancelled") {
      this.patchStatus(task, manualIntent("cancelled"), "cancelled")
      return
    }

    const currentStepIndex = getCurrentFlowStepIndexFromTasks(subtasks)
    if (currentStepIndex === null) {
      throw new Error("Completed flows can only be auto-set or cancelled")
    }

    if (requestedStatus === "backlog") {
      this.patchStatus(task, manualIntent("backlog"), "backlog")
      return
    }

    throw new Error("Use auto to let a flow follow its current step")
  }

  private async normalizeStandardTask(task: Doc<"tasks">) {
    const subtasks = await this.loader.getDirectSubtasks(task._id)
    const review = await this.loader.getReviewState(task._id)
    const progress = getProgress(subtasks.map((subtask) => subtask.status))
    const intent = standardIntentFor(task)
    const effectiveStatus = resolveStandardEffectiveStatus({
      intent,
      review,
      progress,
    })

    this.patchStatus(task, intent, effectiveStatus)
  }

  private async normalizeFlowTask(task: Doc<"tasks">) {
    const subtasks = await this.loader.getDirectSubtasks(task._id)
    if (subtasks.length === 0) {
      await this.normalizeEmptyFlow(task)
      return
    }

    const intent = task.statusIntent
    if (intent.type === "manual" && intent.status === "cancelled") {
      this.patchCancelledFlow(task)
      return
    }

    const currentStepIndex = getCurrentFlowStepIndexFromTasks(subtasks)
    if (currentStepIndex === null) {
      await this.completeFlow(task, subtasks)
      return
    }

    if (isBacklogIntent(intent)) {
      await this.pauseFlow(task, subtasks, currentStepIndex)
      return
    }

    await this.runActiveFlow(task, subtasks, currentStepIndex)
  }

  private async normalizeEmptyFlow(task: Doc<"tasks">) {
    const statusIntent = standardIntentFor(task)
    const standardTask = this.convertEmptyFlowToStandard(task, statusIntent)
    await this.normalizeStandardTask(standardTask)
  }

  private convertEmptyFlowToStandard(
    task: Doc<"tasks">,
    statusIntent: TaskStatusIntent = manualIntent(task.status)
  ): Doc<"tasks"> {
    const standardTask: Doc<"tasks"> = {
      ...task,
      kind: "standard",
      statusIntent,
    }

    this.patchTask(task, { kind: "standard", statusIntent })
    return standardTask
  }

  private patchCancelledFlow(task: Doc<"tasks">) {
    this.patchTask(task, { status: "cancelled" })
  }

  private async completeFlow(task: Doc<"tasks">, subtasks: Doc<"tasks">[]) {
    this.patchStatus(
      task,
      autoStatusIntent(),
      await this.resolveAutoFlowStatus(task, subtasks)
    )
  }

  private async pauseFlow(
    task: Doc<"tasks">,
    subtasks: Doc<"tasks">[],
    currentStepIndex: number
  ) {
    for (const [index, subtask] of subtasks.entries()) {
      if (index < currentStepIndex && isTerminalComplete(subtask.status)) {
        continue
      }
      await this.backlogTaskForFlow(subtask)
    }
    this.patchTask(task, { status: "backlog" })
  }

  private async runActiveFlow(
    task: Doc<"tasks">,
    subtasks: Doc<"tasks">[],
    currentStepIndex: number
  ) {
    for (const [index, subtask] of subtasks.entries()) {
      if (index === currentStepIndex) {
        await this.activateTaskTree(subtask)
      } else if (index > currentStepIndex) {
        await this.backlogTaskForFlow(subtask)
      }
    }

    const updatedSubtasks = await this.loader.getDirectSubtasks(task._id)

    this.patchStatus(
      task,
      autoStatusIntent(),
      await this.resolveAutoFlowStatus(task, updatedSubtasks)
    )
  }

  private async resolveAutoFlowStatus(
    task: Doc<"tasks">,
    subtasks: Doc<"tasks">[]
  ) {
    const review = await this.loader.getReviewState(task._id)
    const progress = getProgress(subtasks.map((subtask) => subtask.status))
    return getEffectiveTaskStatus(
      {
        ...task,
        statusIntent: autoStatusIntent(),
      },
      review,
      progress,
      subtasks
    )
  }

  private async activateTaskTree(task: Doc<"tasks">) {
    if (isBacklogish(task)) {
      this.patchStatus(
        task,
        task.kind === "flow" ? autoStatusIntent() : manualIntent("to-do"),
        "to-do"
      )
    }

    if (task.kind === "flow") return
    await this.activateStandardTaskTree(task)
  }

  private async activateStandardTaskTree(task: Doc<"tasks">) {
    if (task.kind !== "standard") return

    const subtasks = await this.loader.getDirectSubtasks(task._id)
    for (const subtask of subtasks) {
      if (!isBacklogish(subtask)) continue
      await this.activateTaskTree(subtask)
    }
  }

  private async backlogTaskForFlow(task: Doc<"tasks">) {
    this.patchStatus(task, manualIntent("backlog"), "backlog")

    if (task.kind === "flow") return

    const subtasks = await this.loader.getDirectSubtasks(task._id)
    for (const subtask of subtasks) {
      if (isTerminalComplete(subtask.status)) continue
      await this.backlogTaskForFlow(subtask)
    }
  }

  private async resumePausedFlowAncestors(task: Doc<"tasks">) {
    const visited = new Set<Id<"tasks">>()

    for (let currentTask: Doc<"tasks"> = task; ; ) {
      if (visited.has(currentTask._id)) {
        throw new Error("Task status recompute parent cycle detected")
      }
      visited.add(currentTask._id)

      const parentFlow = await this.getParentFlowContext(currentTask)
      if (parentFlow?.state !== "current") return

      if (isBacklogIntent(parentFlow.parent.statusIntent)) {
        this.patchStatus(parentFlow.parent, autoStatusIntent(), "to-do")
      }

      currentTask = parentFlow.parent
    }
  }

  private async getParentFlowContext(
    task: Doc<"tasks">
  ): Promise<ParentFlowContext | null> {
    const parentTaskId = getParentTaskId(task)
    if (!parentTaskId) return null

    const parent = await this.loader.getTask(parentTaskId)
    if (parent?.kind !== "flow") return null

    const siblings = await this.loader.getDirectSubtasks(parent._id)
    const siblingIndex = siblings.findIndex(
      (sibling) => sibling._id === task._id
    )
    if (siblingIndex === -1) return null

    const currentStepIndex = getCurrentFlowStepIndexFromTasks(siblings)
    return {
      parent,
      state: getFlowSiblingState(task, siblingIndex, currentStepIndex),
    }
  }
}

function isBacklogish(task: Doc<"tasks">): boolean {
  return isBacklogIntent(task.statusIntent) || task.status === "backlog"
}

function flowConversionIntent(task: Doc<"tasks">): TaskStatusIntent {
  return task.status === "backlog"
    ? manualIntent("backlog")
    : autoStatusIntent()
}

function standardIntentFor(task: Doc<"tasks">): TaskStatusIntent {
  return task.statusIntent.type === "auto"
    ? manualIntent(task.status)
    : task.statusIntent
}

function getFlowSiblingState(
  task: Doc<"tasks">,
  siblingIndex: number,
  currentStepIndex: number | null
): FlowStepState {
  if (currentStepIndex === null || siblingIndex < currentStepIndex) {
    return "complete"
  }
  if (siblingIndex > currentStepIndex) return "future"
  return isTerminalComplete(task.status) ? "complete" : "current"
}

function isEmptyPatch(patch: TaskStatusPatch) {
  return Object.keys(patch).length === 0
}

function applyPatchValue<T>({
  effectiveValue,
  persistedValue,
  nextValue,
  clearValue,
  setValue,
  equals = Object.is,
}: {
  effectiveValue: T
  persistedValue: T
  nextValue: T | undefined
  clearValue: () => void
  setValue: (value: T) => void
  equals?: (left: T, right: T) => boolean
}) {
  if (nextValue === undefined || equals(effectiveValue, nextValue)) return false

  if (equals(persistedValue, nextValue)) {
    clearValue()
  } else {
    setValue(nextValue)
  }
  return true
}
