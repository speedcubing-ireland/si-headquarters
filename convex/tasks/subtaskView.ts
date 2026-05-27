import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import {
  createTaskViewDisplayReader,
  taskViewProgress,
  taskViewTaskDetails,
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

export const subtaskViewOwner = v.union(
  objectRef("competitions"),
  objectRef("tasks")
)

const subtaskViewRow = v.object({
  ...taskViewTaskDetails.fields,
  path: v.object({
    taskTitle: v.string(),
    subtaskTitle: v.string(),
    subtaskIndicator: v.union(v.string(), v.null()),
  }),
})

const subtaskViewSection = v.object({
  id: v.string(),
  phaseId: v.union(v.id("phases"), v.null()),
  title: v.string(),
  isCurrent: v.boolean(),
  progress: taskViewProgress,
  rows: v.array(subtaskViewRow),
})

export const taskSubtaskView = v.object({
  owner: subtaskViewOwner,
  sections: v.array(subtaskViewSection),
})

export type SubtaskViewOwner = Infer<typeof subtaskViewOwner>
export type TaskSubtaskView = Infer<typeof taskSubtaskView>

type TaskDisplayReader = ReturnType<typeof createTaskViewDisplayReader>
type TaskStatus = TaskWithStatusView["statusView"]["effectiveStatus"]

function getSubtaskIndicator(progress: Infer<typeof taskViewProgress>) {
  if (progress.total === 0) return null
  return `${String(progress.done)}/${String(progress.total)}`
}

async function listCompetitionPhases(
  ctx: QueryCtx,
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
  displayReader,
  loader,
  hideParentTitleForDirect,
  parentTitle,
  taskViews,
}: {
  displayReader: TaskDisplayReader
  loader: TaskStatusLoader
  hideParentTitleForDirect: boolean
  parentTitle: string
  taskViews: TaskWithStatusView[]
}): Promise<{
  rows: TaskSubtaskView["sections"][number]["rows"]
  statuses: TaskStatus[]
}> {
  const rows: TaskSubtaskView["sections"][number]["rows"] = []
  const statuses: TaskStatus[] = []

  for (const taskView of taskViews) {
    const row = await displayReader.hydrateTaskDetails(taskView)
    const subtaskTitle = hideParentTitleForDirect ? "" : parentTitle
    rows.push({
      ...row,
      path: {
        taskTitle: row.task.name,
        subtaskTitle,
        subtaskIndicator: getSubtaskIndicator(row.statusView.progress),
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

    const childTaskViews = await getTaskSubtaskViews(loader, taskView.task)
    if (childTaskViews.length === 0) continue

    const childResult = await buildSubtaskRows({
      displayReader,
      loader,
      hideParentTitleForDirect: false,
      parentTitle: row.task.name,
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
  parentTitle: string
  phaseId: Id<"phases"> | null
  title: string
  taskViews: TaskWithStatusView[]
}): Promise<TaskSubtaskView["sections"][number]> {
  const { rows, statuses } = await buildSubtaskRows({
    displayReader,
    loader,
    hideParentTitleForDirect,
    parentTitle,
    taskViews,
  })

  return {
    id,
    phaseId,
    title,
    isCurrent,
    progress: getProgress(statuses),
    rows,
  }
}

export async function getTaskSubtaskView(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<TaskSubtaskView> {
  const task = await ctx.db.get("tasks", taskId)
  if (!task) throw new Error("Task not found")

  const loader = new TaskStatusLoader(ctx)
  const displayReader = createTaskViewDisplayReader(ctx)
  const taskViews = await getTaskSubtaskViews(loader, task)

  return {
    owner: { type: "tasks", id: task._id },
    sections: [
      await buildSubtaskSection({
        displayReader,
        loader,
        hideParentTitleForDirect: true,
        id: `task:${task._id}:subtasks`,
        isCurrent: false,
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
  const loader = new TaskStatusLoader(ctx)
  const displayReader = createTaskViewDisplayReader(ctx)
  const sections = await Promise.all(
    phases.map(async (phase) =>
      buildSubtaskSection({
        displayReader,
        loader,
        hideParentTitleForDirect: true,
        id: `phase:${phase._id}`,
        isCurrent: competition.phaseId === phase._id,
        parentTitle: phase.name,
        phaseId: phase._id,
        title: phase.name,
        taskViews: await getPhaseTaskViews(loader, phase._id),
      })
    )
  )

  return {
    owner: { type: "competitions", id: competition._id },
    sections,
  }
}
