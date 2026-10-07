import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import {
  buildFlatTaskInlinePath,
  taskInlineRow,
} from "@/convex/tasks/inlineRow"
import { TaskBlockersLoader } from "@/convex/tasks/blockers/loader"
import {
  buildSubtasksWithStatusViews,
  buildTaskStatusView,
  TaskStatusLoader,
  type TaskWithStatusView,
} from "@/convex/tasks/status/resolver"
import { createTaskViewDisplayReader } from "@/convex/tasks/view"
import type { TaskStatus } from "@/convex/tasks/status/validators"
import { v, type Infer } from "convex/values"

export const taskBoardRow = v.object({
  ...taskInlineRow.fields,
  competitionId: v.union(v.id("competitions"), v.null()),
  projectId: v.union(v.id("projects"), v.null()),
  phaseId: v.union(v.id("phases"), v.null()),
  competitionName: v.union(v.string(), v.null()),
  competitionYear: v.union(v.number(), v.null()),
  projectName: v.union(v.string(), v.null()),
  phaseName: v.union(v.string(), v.null()),
})

export type TaskBoardRow = Infer<typeof taskBoardRow>
/** Deliberately excludes unloaded display fields; never crosses a query boundary. */
export type TaskBoardSummary = Omit<TaskBoardRow, "labels" | "subtaskSummary">

function getCompetitionYear(
  competition: Doc<"competitions"> | null
): number | null {
  if (!competition) return null

  for (const value of [competition.compDates.from, competition.compDates.to]) {
    if (value === null || value === "") continue
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getFullYear()
    }
  }

  const yearInName = /\b(\d{4})\b/.exec(competition.name)
  return yearInName ? Number(yearInName[1]) : null
}

function getTaskRootDisplayContext(
  task: Doc<"tasks">,
  phaseById: Map<Id<"phases">, Doc<"phases">>,
  competitionById: Map<Id<"competitions">, Doc<"competitions">>,
  projectById: Map<Id<"projects">, Doc<"projects">>
) {
  const phase = phaseById.get(task.rootPhase.id)
  if (!phase) throw new Error("Task phase missing from board context")
  const competition =
    task.root.type === "competitions" ? competitionById.get(task.root.id) : null
  const project =
    task.root.type === "projects" ? projectById.get(task.root.id) : null
  if (competition === undefined || project === undefined) {
    throw new Error("Task root missing from board context")
  }
  return {
    competitionId: competition?._id ?? null,
    projectId: project?._id ?? null,
    phaseId: phase._id,
    competitionName: competition?.name ?? null,
    competitionYear: getCompetitionYear(competition),
    projectName: project?.name ?? null,
    phaseName: phase.name,
  }
}

async function buildDirectSubtaskViewsByParentId(
  statusLoader: TaskStatusLoader,
  taskById: Map<Id<"tasks">, Doc<"tasks">>
) {
  const directSubtaskViewsByParentId = new Map<
    Id<"tasks">,
    TaskWithStatusView[]
  >()

  const parentIds = new Set(
    [...taskById.values()].flatMap((task) =>
      task.parent.type === "tasks" ? [task.parent.id] : []
    )
  )
  await Promise.all(
    [...parentIds].map(async (parentId) => {
      const parent = taskById.get(parentId)
      if (!parent) throw new Error("Task parent missing from board context")

      directSubtaskViewsByParentId.set(
        parentId,
        await buildSubtasksWithStatusViews(statusLoader, parent)
      )
    })
  )

  return directSubtaskViewsByParentId
}

export async function createTaskBoardReader(
  ctx: QueryCtx,
  input: {
    /** Complete roots are required for flow positions and recursive progress. */
    tasks: Doc<"tasks">[]
    /** Authorized rows to emit; other tasks are status context only. */
    selectedTaskIds: ReadonlySet<Id<"tasks">>
    phases: Doc<"phases">[]
    competitions: Doc<"competitions">[]
    projects: Doc<"projects">[]
    taskReviewers: Doc<"taskReviewers">[]
    taskReviewOverrides: Doc<"taskReviewOverrides">[]
    taskBlockers: Doc<"taskBlockers">[]
    preloadedLabels?: {
      assignments: Doc<"taskLabelAssignments">[]
      labels: Doc<"taskLabels">[]
    }
  }
) {
  const {
    phases,
    competitions,
    projects,
    taskReviewers,
    taskReviewOverrides,
    taskBlockers,
  } = input
  // Root-index reads concatenate trees; restoring creation order keeps scoped
  // and global boards identical when no display ordering is selected.
  const tasks = [...input.tasks].sort(
    (a, b) => a._creationTime - b._creationTime || a._id.localeCompare(b._id)
  )
  const taskById = new Map(tasks.map((task) => [task._id, task]))
  const phaseById = new Map(phases.map((phase) => [phase._id, phase]))
  const competitionById = new Map(
    competitions.map((competition) => [competition._id, competition])
  )
  const projectById = new Map(projects.map((project) => [project._id, project]))
  const statusLoader = new TaskStatusLoader(ctx)
  statusLoader.primeTasks(tasks)
  statusLoader.primeReviewParts(
    taskById.keys(),
    taskReviewers,
    taskReviewOverrides
  )
  const blockersLoader = new TaskBlockersLoader(ctx)
  blockersLoader.primeEdges(taskById.keys(), taskBlockers)
  const displayReader = createTaskViewDisplayReader(ctx, {
    blockersLoader,
    statusLoader,
    preloadedLabels: input.preloadedLabels,
  })
  const directSubtaskViewsByParentId = await buildDirectSubtaskViewsByParentId(
    statusLoader,
    taskById
  )

  // A flow's child positions are resolved together once, rather than rebuilding
  // all sibling views for every child (quadratic in the size of the flow).
  const childStatusById = new Map(
    [...directSubtaskViewsByParentId.values()]
      .flat()
      .map((view) => [view.task._id, view.statusView])
  )

  async function getSummaries({
    effectiveStatuses,
  }: {
    effectiveStatuses?: TaskStatus[]
  } = {}): Promise<TaskBoardSummary[]> {
    const rows = await Promise.all(
      tasks
        .filter((task) => input.selectedTaskIds.has(task._id))
        .map(async (task) => {
          const statusView =
            childStatusById.get(task._id) ??
            (await buildTaskStatusView(statusLoader, task))
          if (
            effectiveStatuses !== undefined &&
            !effectiveStatuses.includes(statusView.effectiveStatus)
          )
            return null
          const details = await displayReader.hydrateTaskSummary({
            task,
            statusView,
          })
          const rootContext = getTaskRootDisplayContext(
            task,
            phaseById,
            competitionById,
            projectById
          )

          return {
            ...details,
            ...rootContext,
            path: buildFlatTaskInlinePath(task, taskById, statusView),
          }
        })
    )
    return rows.filter((row) => row !== null)
  }

  async function hydrateRows(
    rows: readonly TaskBoardSummary[]
  ): Promise<TaskBoardRow[]> {
    return await Promise.all(
      rows.map(async (row) => {
        const task = taskById.get(row.task._id)
        if (!task) throw new Error("Task not found in board context")
        const display = await displayReader.getTaskDisplayDetails({
          task,
          directSubtaskViews: directSubtaskViewsByParentId.get(task._id),
        })
        return {
          ...row,
          ...display,
        }
      })
    )
  }

  return { getSummaries, hydrateRows }
}
