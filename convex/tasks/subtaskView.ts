import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { requireCompetitionForUpdate } from "@/convex/plugins/core/authorize"
import { requireTaskManageAccess } from "@/convex/tasks/access"
import { TaskBlockersLoader } from "@/convex/tasks/blockers/loader"
import { taskKindType } from "@/convex/tasks/kind"
import { phaseColor } from "@/convex/phases/validators"
import { taskParentRef, type TaskParentRef } from "@/convex/tasks/validators"
import {
  getSubtaskIndicatorFromProgress,
  taskInlineRow,
} from "@/convex/tasks/inlineRow"
import {
  createTaskViewDisplayReader,
  taskViewProgress,
} from "@/convex/tasks/view"
import {
  buildSubtasksWithStatusViews,
  buildTaskStatusViewWithFlowPosition,
  TaskStatusLoader,
  type TaskWithStatusView,
} from "@/convex/tasks/status/resolver"
import { getProgress } from "@/convex/tasks/status/rules"
import { objectRef } from "@/convex/utils"
import { v, type Infer } from "convex/values"

const MAX_COMPETITION_PHASES_FOR_SUBTASK_VIEW = 50
const MAX_TASK_CREATION_TARGETS_PER_SECTION = 200

export const subtaskViewOwner = v.union(
  objectRef("competitions"),
  objectRef("tasks")
)

const subtaskViewRow = taskInlineRow

const subtaskViewSection = v.object({
  id: v.string(),
  parent: v.union(taskParentRef, v.null()),
  phaseId: v.union(v.id("phases"), v.null()),
  title: v.string(),
  isCurrent: v.boolean(),
  progress: taskViewProgress,
  rows: v.array(subtaskViewRow),
})

export const taskSubtaskView = v.object({
  owner: subtaskViewOwner,
  defaultParent: v.union(taskParentRef, v.null()),
  sections: v.array(subtaskViewSection),
})

export type SubtaskViewOwner = Infer<typeof subtaskViewOwner>
export type TaskSubtaskView = Infer<typeof taskSubtaskView>

type DbCtx = Pick<QueryCtx | MutationCtx, "db">

export const taskCreationPhaseTarget = v.object({
  _id: v.id("phases"),
  name: v.string(),
  color: phaseColor,
  competitionId: v.id("competitions"),
  competitionName: v.string(),
})

export const taskCreationTaskTarget = v.object({
  _id: v.id("tasks"),
  name: v.string(),
  kind: taskKindType,
  sectionTitle: v.string(),
})

export const taskCreationTargetSection = v.object({
  id: v.string(),
  title: v.string(),
  phase: v.union(taskCreationPhaseTarget, v.null()),
  tasks: v.array(taskCreationTaskTarget),
})

export const taskCreationTargets = v.object({
  sections: v.array(taskCreationTargetSection),
})

export type TaskCreationPhaseTarget = Infer<typeof taskCreationPhaseTarget>
export type TaskCreationTaskTarget = Infer<typeof taskCreationTaskTarget>
export type TaskCreationTargetSection = Infer<typeof taskCreationTargetSection>
export type TaskCreationTargets = Infer<typeof taskCreationTargets>

interface TaskDisplayReaderContext {
  displayReader: ReturnType<typeof createTaskViewDisplayReader>
  loader: TaskStatusLoader
}

type TaskDisplayReader = TaskDisplayReaderContext["displayReader"]
type TaskStatus = TaskWithStatusView["statusView"]["effectiveStatus"]

async function listCompetitionPhases(
  ctx: DbCtx,
  competitionId: Id<"competitions">
) {
  const phases = await ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", "competitions").eq("owner.id", competitionId)
    )
    .order("asc")
    .take(MAX_COMPETITION_PHASES_FOR_SUBTASK_VIEW + 1)

  if (phases.length > MAX_COMPETITION_PHASES_FOR_SUBTASK_VIEW) {
    throw new Error(
      `Competition has more than ${String(
        MAX_COMPETITION_PHASES_FOR_SUBTASK_VIEW
      )} phases`
    )
  }

  return phases
}

async function getPhaseTaskViews(
  loader: TaskStatusLoader,
  phaseId: Id<"phases">
): Promise<TaskWithStatusView[]> {
  const tasks = await loader.getPhaseTasks(phaseId)

  return await Promise.all(
    tasks.map(async (task) => ({
      task,
      statusView: await buildTaskStatusViewWithFlowPosition(loader, task),
    }))
  )
}

async function getTaskSubtaskViews(
  loader: TaskStatusLoader,
  task: Doc<"tasks">
) {
  const subtasks = await loader.getDirectSubtasks(task._id)
  return await buildSubtasksWithStatusViews(loader, task, subtasks)
}

async function buildSubtaskRows({
  depth,
  displayReader,
  loader,
  hideParentTitleForDirect,
  parentTitle,
  parentTaskId,
  taskViews,
}: {
  depth: number
  displayReader: TaskDisplayReader
  loader: TaskStatusLoader
  hideParentTitleForDirect: boolean
  parentTitle: string
  parentTaskId: Id<"tasks"> | null
  taskViews: TaskWithStatusView[]
}): Promise<{
  rows: TaskSubtaskView["sections"][number]["rows"]
  statuses: TaskStatus[]
}> {
  const rows: TaskSubtaskView["sections"][number]["rows"] = []
  const statuses: TaskStatus[] = []

  for (const taskView of taskViews) {
    const childTaskViews = await getTaskSubtaskViews(loader, taskView.task)
    const row = await displayReader.hydrateTaskDetails({
      ...taskView,
      directSubtaskViews: childTaskViews,
    })
    const subtaskTitle = hideParentTitleForDirect ? "" : parentTitle
    rows.push({
      ...row,
      path: {
        taskTitle: row.task.name,
        subtaskTitle,
        subtaskIndicator: getSubtaskIndicatorFromProgress(
          row.statusView.progress
        ),
        taskTitleId: row.task._id,
        subtaskTitleId: hideParentTitleForDirect ? null : parentTaskId,
        depth,
      },
    })

    const rowStatus = taskView.statusView.effectiveStatus
    statuses.push(rowStatus)

    if (
      taskView.task.kind === "flow" ||
      rowStatus === "done" ||
      rowStatus === "cancelled"
    )
      continue

    if (childTaskViews.length === 0) continue

    const childResult = await buildSubtaskRows({
      depth: depth + 1,
      displayReader,
      loader,
      hideParentTitleForDirect: false,
      parentTitle: row.task.name,
      parentTaskId: row.task._id,
      taskViews: childTaskViews,
    })
    rows.push(...childResult.rows)
    statuses.push(...childResult.statuses)
  }

  return { rows, statuses }
}

async function buildSubtaskSection({
  displayReader,
  loader,
  hideParentTitleForDirect,
  id,
  isCurrent,
  parent,
  parentTitle,
  phaseId,
  title,
  taskViews,
}: {
  displayReader: TaskDisplayReader
  loader: TaskStatusLoader
  hideParentTitleForDirect: boolean
  id: string
  isCurrent: boolean
  parent: TaskParentRef | null
  parentTitle: string
  phaseId: Id<"phases"> | null
  title: string
  taskViews: TaskWithStatusView[]
}): Promise<TaskSubtaskView["sections"][number]> {
  const { rows, statuses } = await buildSubtaskRows({
    depth: 0,
    displayReader,
    loader,
    hideParentTitleForDirect,
    parentTitle,
    parentTaskId: null,
    taskViews,
  })

  return {
    id,
    parent,
    phaseId,
    title,
    isCurrent,
    progress: getProgress(statuses),
    rows,
  }
}

function createSubtaskDisplayReaderContext(
  ctx: QueryCtx
): TaskDisplayReaderContext {
  const loader = new TaskStatusLoader(ctx)
  const blockersLoader = new TaskBlockersLoader(ctx)

  return {
    loader,
    displayReader: createTaskViewDisplayReader(ctx, {
      blockersLoader,
      statusLoader: loader,
    }),
  }
}

export async function getTaskSubtaskView(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<TaskSubtaskView> {
  const task = await ctx.db.get("tasks", taskId)
  if (!task) throw new Error("Task not found")

  const { displayReader, loader } = createSubtaskDisplayReaderContext(ctx)
  const taskViews = await getTaskSubtaskViews(loader, task)

  return {
    owner: { type: "tasks", id: task._id },
    defaultParent: { type: "tasks", id: task._id },
    sections: [
      await buildSubtaskSection({
        displayReader,
        loader,
        hideParentTitleForDirect: true,
        id: `task:${task._id}:subtasks`,
        isCurrent: false,
        parent: { type: "tasks", id: task._id },
        parentTitle: task.name,
        phaseId: null,
        title: "Subtasks",
        taskViews,
      }),
    ],
  }
}

export async function getCompetitionSubtaskView(
  ctx: QueryCtx,
  competitionId: Id<"competitions">
): Promise<TaskSubtaskView> {
  const competition = await ctx.db.get("competitions", competitionId)
  if (!competition) throw new Error("Competition not found")

  const phases = await listCompetitionPhases(ctx, competition._id)
  const { displayReader, loader } = createSubtaskDisplayReaderContext(ctx)
  const currentPhase = phases.find((phase) => phase._id === competition.phaseId)
  const defaultParent =
    currentPhase === undefined
      ? null
      : { type: "phases" as const, id: currentPhase._id }
  const sections = await Promise.all(
    phases.map(async (phase) =>
      buildSubtaskSection({
        displayReader,
        loader,
        hideParentTitleForDirect: true,
        id: `phase:${phase._id}`,
        isCurrent: competition.phaseId === phase._id,
        parent: { type: "phases", id: phase._id },
        parentTitle: phase.name,
        phaseId: phase._id,
        title: phase.name,
        taskViews: await getPhaseTaskViews(loader, phase._id),
      })
    )
  )

  return {
    owner: { type: "competitions", id: competition._id },
    defaultParent,
    sections,
  }
}

function toCreationTaskTarget(
  task: Pick<Doc<"tasks">, "_id" | "name" | "kind">,
  sectionTitle: string
): TaskCreationTaskTarget {
  return {
    _id: task._id,
    name: task.name,
    kind: task.kind,
    sectionTitle,
  }
}

function toCreationPhaseTarget(
  phase: Pick<Doc<"phases">, "_id" | "name" | "color">,
  competition: Pick<Doc<"competitions">, "_id" | "name">
): TaskCreationPhaseTarget {
  return {
    _id: phase._id,
    name: phase.name,
    color: phase.color,
    competitionId: competition._id,
    competitionName: competition.name,
  }
}

async function listDirectTaskTargets(
  ctx: DbCtx,
  parent: TaskParentRef,
  sectionTitle: string
): Promise<TaskCreationTaskTarget[]> {
  const tasks =
    parent.type === "phases"
      ? await ctx.db
          .query("tasks")
          .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
            q.eq("parent.type", "phases").eq("parent.id", parent.id)
          )
          .order("asc")
          .take(MAX_TASK_CREATION_TARGETS_PER_SECTION + 1)
      : await ctx.db
          .query("tasks")
          .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
            q.eq("parent.type", "tasks").eq("parent.id", parent.id)
          )
          .order("asc")
          .take(MAX_TASK_CREATION_TARGETS_PER_SECTION + 1)

  if (tasks.length > MAX_TASK_CREATION_TARGETS_PER_SECTION) {
    throw new Error(
      `Task parent has more than ${String(
        MAX_TASK_CREATION_TARGETS_PER_SECTION
      )} direct tasks`
    )
  }

  return tasks.map((task) => toCreationTaskTarget(task, sectionTitle))
}

async function buildCompetitionCreationSections(
  ctx: DbCtx,
  competitionId: Id<"competitions">
): Promise<TaskCreationTargetSection[]> {
  const competition = await ctx.db.get("competitions", competitionId)
  if (competition === null) throw new Error("Competition not found")

  return await Promise.all(
    (await listCompetitionPhases(ctx, competition._id)).map(async (phase) => ({
      id: `phase:${phase._id}`,
      title: phase.name,
      phase: toCreationPhaseTarget(phase, competition),
      tasks: await listDirectTaskTargets(
        ctx,
        { type: "phases", id: phase._id },
        phase.name
      ),
    }))
  )
}

async function buildTaskCreationSections(
  ctx: DbCtx,
  taskId: Id<"tasks">
): Promise<TaskCreationTargetSection[]> {
  const ownerTask = await ctx.db.get("tasks", taskId)
  if (ownerTask === null) throw new Error("Task not found")

  return [
    {
      id: `task:${ownerTask._id}:self`,
      title: ownerTask.name,
      phase: null,
      tasks: [toCreationTaskTarget(ownerTask, ownerTask.name)],
    },
    {
      id: `task:${ownerTask._id}:subtasks`,
      title: "Subtasks",
      phase: null,
      tasks: await listDirectTaskTargets(
        ctx,
        { type: "tasks", id: ownerTask._id },
        "Subtasks"
      ),
    },
  ]
}

function matchesCreationSearch(
  search: string,
  ...values: (string | null | undefined)[]
) {
  if (search.length === 0) return true
  const normalizedSearch = search.toLocaleLowerCase()

  return values.some(
    (value) => value?.toLocaleLowerCase().includes(normalizedSearch) ?? false
  )
}

function parentMatchesCreationSection(
  parent: TaskParentRef,
  section: TaskCreationTargetSection
) {
  if (parent.type === "phases") {
    return section.phase?._id === parent.id
  }

  return section.tasks.some((task) => task._id === parent.id)
}

function filterCreationTargetSections(
  sections: TaskCreationTargetSection[],
  search: string,
  selectedParent: TaskParentRef | null
): TaskCreationTargetSection[] {
  const filteredSections = sections.map((section) => ({
    ...section,
    phase:
      section.phase !== null &&
      matchesCreationSearch(
        search,
        section.phase.name,
        section.phase.competitionName
      )
        ? section.phase
        : null,
    tasks: section.tasks.filter((task) =>
      matchesCreationSearch(search, task.name, task.sectionTitle, section.title)
    ),
  }))

  const visibleSections = filteredSections.filter(
    (section) => section.phase !== null || section.tasks.length > 0
  )

  if (selectedParent === null) {
    return visibleSections
  }

  const sourceSection = sections.find((section) =>
    parentMatchesCreationSection(selectedParent, section)
  )
  if (sourceSection === undefined) {
    return visibleSections
  }

  const selectedPhase =
    selectedParent.type === "phases" ? (sourceSection.phase ?? null) : null
  const selectedTask =
    selectedParent.type === "tasks"
      ? (sourceSection.tasks.find((task) => task._id === selectedParent.id) ??
        null)
      : null

  const pinnedSection = visibleSections.find(
    (section) => section.id === sourceSection.id
  )

  if (pinnedSection === undefined) {
    return [
      ...visibleSections,
      {
        id: sourceSection.id,
        title: sourceSection.title,
        phase: selectedPhase,
        tasks: selectedTask === null ? [] : [selectedTask],
      },
    ]
  }

  return visibleSections.map((section) => {
    if (section.id !== sourceSection.id) return section

    const tasks =
      selectedTask === null
        ? section.tasks
        : section.tasks.some((task) => task._id === selectedTask._id)
          ? section.tasks
          : [...section.tasks, selectedTask]

    return {
      ...section,
      phase:
        selectedPhase === null
          ? section.phase
          : (section.phase ?? selectedPhase),
      tasks,
    }
  })
}

export async function buildCreationTargetSections(
  ctx: DbCtx,
  scope: SubtaskViewOwner
): Promise<TaskCreationTargetSection[]> {
  if (scope.type === "competitions") {
    return await buildCompetitionCreationSections(ctx, scope.id)
  }

  return await buildTaskCreationSections(ctx, scope.id)
}

export function isValidCreationParent(
  parent: TaskParentRef,
  sections: TaskCreationTargetSection[]
) {
  return sections.some((section) =>
    parentMatchesCreationSection(parent, section)
  )
}

export async function requireValidCreationParent(
  ctx: DbCtx,
  scope: SubtaskViewOwner,
  parent: TaskParentRef
) {
  const sections = await buildCreationTargetSections(ctx, scope)
  if (!isValidCreationParent(parent, sections)) {
    throw new Error("Task parent is not available in this view")
  }
}

export async function listCreationTargetsForScope(
  ctx: QueryCtx,
  args: {
    scope: SubtaskViewOwner
    search?: string
    selectedParent?: TaskParentRef | null
  }
): Promise<TaskCreationTargets> {
  if (args.scope.type === "competitions") {
    await requireCompetitionForUpdate(ctx, args.scope.id)
  } else {
    await requireTaskManageAccess(ctx, args.scope.id)
  }

  const search = (args.search ?? "").trim()
  const selectedParent = args.selectedParent ?? null
  const sections = await buildCreationTargetSections(ctx, args.scope)

  return {
    sections: filterCreationTargetSections(sections, search, selectedParent),
  }
}
