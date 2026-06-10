import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { collectAll, type CompetitionOrProjectRef } from "@/convex/utils"
import type { TaskInlineRow } from "@/convex/tasks/inlineRow"
import {
  buildTaskStatusViewWithFlowPosition,
  type TaskStatusLoader,
  type TaskWithStatusView,
} from "@/convex/tasks/status/resolver"
import {
  isTerminalComplete,
  type TaskStatus,
} from "@/convex/tasks/status/rules"

export interface OverdueContext {
  today: string
  ownerCurrentPhaseId: Id<"phases"> | null
  phaseSortKeyById: Map<Id<"phases">, string>
}

export function buildPhaseSortKeyById(phases: Doc<"phases">[]) {
  return new Map(phases.map((phase) => [phase._id, phase.sortKey]))
}

export interface OwnerPhaseScanContext {
  competitionPhaseById: Map<Id<"competitions">, Id<"phases"> | null>
  projectPhaseById: Map<Id<"projects">, Id<"phases"> | null>
  phaseSortKeyById: Map<Id<"phases">, string>
}

type ScanCtx = Pick<QueryCtx | MutationCtx, "db">

export function buildOwnerPhaseScanContext(
  competitions: Doc<"competitions">[],
  projects: Doc<"projects">[],
  phases: Doc<"phases">[]
): OwnerPhaseScanContext {
  return {
    competitionPhaseById: new Map(
      competitions.map((competition) => [competition._id, competition.phaseId])
    ),
    projectPhaseById: new Map(
      projects.map((project) => [project._id, project.phaseId])
    ),
    phaseSortKeyById: buildPhaseSortKeyById(phases),
  }
}

export async function loadOwnerPhaseScanContext(
  ctx: ScanCtx
): Promise<OwnerPhaseScanContext> {
  const [competitions, projects, phases] = await Promise.all([
    collectAll(ctx, "competitions"),
    collectAll(ctx, "projects"),
    collectAll(ctx, "phases"),
  ])
  return buildOwnerPhaseScanContext(competitions, projects, phases)
}

export function currentPhaseIdForOwner(
  owner: CompetitionOrProjectRef,
  competitionPhaseById: Map<Id<"competitions">, Id<"phases"> | null>,
  projectPhaseById: Map<Id<"projects">, Id<"phases"> | null>
): Id<"phases"> | null {
  if (owner.type === "competitions") {
    return competitionPhaseById.get(owner.id) ?? null
  }
  return projectPhaseById.get(owner.id) ?? null
}

export function isEarlierPhase(
  phaseId: Id<"phases">,
  currentPhaseId: Id<"phases"> | null,
  phaseSortKeyById: Map<Id<"phases">, string>
) {
  if (currentPhaseId === null || phaseId === currentPhaseId) return false
  const phaseSortKey = phaseSortKeyById.get(phaseId)
  const currentSortKey = phaseSortKeyById.get(currentPhaseId)
  if (phaseSortKey === undefined || currentSortKey === undefined) return false
  return phaseSortKey < currentSortKey
}

function isDateOverdue(
  dueDate: string | null,
  today: string,
  effectiveStatus: TaskStatus
) {
  if (isTerminalComplete(effectiveStatus)) return false
  if (dueDate === null) return false
  return dueDate < today
}

function isDirectPhaseScopedTask(input: {
  phaseId: Id<"phases"> | null
  subtaskTitleId: Id<"tasks"> | null
  competitionId: Id<"competitions"> | null
  projectId: Id<"projects"> | null
}) {
  return (
    input.phaseId !== null &&
    input.subtaskTitleId === null &&
    (input.competitionId !== null || input.projectId !== null)
  )
}

function isPhaseCarryOver(input: {
  effectiveStatus: TaskStatus
  phaseId: Id<"phases"> | null
  subtaskTitleId: Id<"tasks"> | null
  competitionId: Id<"competitions"> | null
  projectId: Id<"projects"> | null
  ownerCurrentPhaseId: Id<"phases"> | null
  phaseSortKeyById: Map<Id<"phases">, string>
}) {
  if (isTerminalComplete(input.effectiveStatus)) return false
  if (
    !isDirectPhaseScopedTask({
      phaseId: input.phaseId,
      subtaskTitleId: input.subtaskTitleId,
      competitionId: input.competitionId,
      projectId: input.projectId,
    })
  ) {
    return false
  }
  if (input.phaseId === null) return false
  return isEarlierPhase(
    input.phaseId,
    input.ownerCurrentPhaseId,
    input.phaseSortKeyById
  )
}

export function isTaskOverdue(
  input: {
    effectiveStatus: TaskStatus
    dueDate: string | null
    phaseId: Id<"phases"> | null
    subtaskTitleId: Id<"tasks"> | null
    competitionId: Id<"competitions"> | null
    projectId: Id<"projects"> | null
  } & OverdueContext
): boolean {
  if (isDateOverdue(input.dueDate, input.today, input.effectiveStatus)) {
    return true
  }

  return isPhaseCarryOver({
    effectiveStatus: input.effectiveStatus,
    phaseId: input.phaseId,
    subtaskTitleId: input.subtaskTitleId,
    competitionId: input.competitionId,
    projectId: input.projectId,
    ownerCurrentPhaseId: input.ownerCurrentPhaseId,
    phaseSortKeyById: input.phaseSortKeyById,
  })
}

function taskOverdueFields(task: Doc<"tasks">) {
  return {
    effectiveStatus: task.status,
    dueDate: task.dueDate,
    phaseId: task.parent.type === "phases" ? task.parent.id : null,
    subtaskTitleId: task.parent.type === "tasks" ? task.parent.id : null,
    competitionId: task.root.type === "competitions" ? task.root.id : null,
    projectId: task.root.type === "projects" ? task.root.id : null,
  }
}

export function isTaskDocOverdue(
  task: Doc<"tasks">,
  ownerCurrentPhaseId: Id<"phases"> | null,
  context: Pick<OverdueContext, "today" | "phaseSortKeyById">
) {
  return isTaskOverdue({
    ...taskOverdueFields(task),
    ownerCurrentPhaseId,
    today: context.today,
    phaseSortKeyById: context.phaseSortKeyById,
  })
}

export function isSubtaskRowOverdue(input: {
  row: Pick<TaskInlineRow, "task" | "statusView" | "path">
  sectionPhaseId: Id<"phases"> | null
  ownerCurrentPhaseId: Id<"phases"> | null
  phaseSortKeyById: Map<Id<"phases">, string>
  today: string
}) {
  const { row, sectionPhaseId, ownerCurrentPhaseId, phaseSortKeyById, today } =
    input

  if (isDateOverdue(row.task.dueDate, today, row.statusView.effectiveStatus)) {
    return true
  }

  if (isTerminalComplete(row.statusView.effectiveStatus)) return false
  if (row.path.depth !== 0) return false
  if (row.path.subtaskTitleId !== null) return false
  if (sectionPhaseId === null) return false

  return isEarlierPhase(sectionPhaseId, ownerCurrentPhaseId, phaseSortKeyById)
}

export async function countOverdueInSection(
  rows: TaskInlineRow[],
  taskViews: TaskWithStatusView[],
  loader: TaskStatusLoader,
  input: {
    sectionPhaseId: Id<"phases"> | null
    ownerCurrentPhaseId: Id<"phases"> | null
    phaseSortKeyById: Map<Id<"phases">, string>
    today: string
  }
) {
  let rowOverdueCount = 0
  for (const row of rows) {
    if (isSubtaskRowOverdue({ row, ...input })) {
      rowOverdueCount += 1
    }
  }

  let flowStepOverdueCount = 0
  for (const taskView of taskViews) {
    if (taskView.task.kind !== "flow") continue

    const steps = await loader.getDirectSubtasks(taskView.task._id)
    for (const step of steps) {
      const statusView = await buildTaskStatusViewWithFlowPosition(loader, step)
      if (
        isDateOverdue(step.dueDate, input.today, statusView.effectiveStatus)
      ) {
        flowStepOverdueCount += 1
      }
    }
  }

  return rowOverdueCount + flowStepOverdueCount
}
