import { collectAll } from "@/convex/utils"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { query, type QueryCtx } from "@/convex/_generated/server"
import { canPerform, requirePrincipal } from "@/convex/permissions/principal"
import { canReadProject } from "@/convex/projects/access"
import {
  buildFlatTaskInlinePath,
  taskInlineRow,
} from "@/convex/tasks/inlineRow"
import { listRootTaskIds } from "@/convex/tasks/blockers/root"
import { TaskBlockersLoader } from "@/convex/tasks/blockers/loader"
import {
  buildSubtasksWithStatusViews,
  buildTaskStatusViewWithFlowPosition,
  TaskStatusLoader,
  type TaskWithStatusView,
} from "@/convex/tasks/status/resolver"
import { createTaskViewDisplayReader } from "@/convex/tasks/view"
import { v } from "convex/values"

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

interface TaskRootDisplayContext {
  competitionId: Id<"competitions"> | null
  projectId: Id<"projects"> | null
  phaseId: Id<"phases"> | null
  competitionName: string | null
  competitionYear: number | null
  projectName: string | null
  phaseName: string | null
}

function getCompetitionYear(
  competition: Doc<"competitions"> | undefined
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

function resolvePhaseContext(
  phaseId: Id<"phases">,
  phaseById: Map<Id<"phases">, Doc<"phases">>,
  competitionById: Map<Id<"competitions">, Doc<"competitions">>,
  projectById: Map<Id<"projects">, Doc<"projects">>
): TaskRootDisplayContext {
  const phase = phaseById.get(phaseId)
  if (!phase) {
    return {
      competitionId: null,
      projectId: null,
      phaseId: null,
      competitionName: null,
      competitionYear: null,
      projectName: null,
      phaseName: null,
    }
  }

  if (phase.owner.type === "competitions") {
    const competition = competitionById.get(phase.owner.id)
    return {
      competitionId: phase.owner.id,
      projectId: null,
      phaseId: phase._id,
      competitionName: competition?.name ?? null,
      competitionYear: getCompetitionYear(competition),
      projectName: null,
      phaseName: phase.name,
    }
  }

  const project = projectById.get(phase.owner.id)
  return {
    competitionId: null,
    projectId: phase.owner.id,
    phaseId: phase._id,
    competitionName: null,
    competitionYear: null,
    projectName: project?.name ?? null,
    phaseName: phase.name,
  }
}

function getTaskRootDisplayContext(
  task: Doc<"tasks">,
  taskById: Map<Id<"tasks">, Doc<"tasks">>,
  phaseById: Map<Id<"phases">, Doc<"phases">>,
  competitionById: Map<Id<"competitions">, Doc<"competitions">>,
  projectById: Map<Id<"projects">, Doc<"projects">>
): TaskRootDisplayContext {
  const empty: TaskRootDisplayContext = {
    competitionId: null,
    projectId: null,
    phaseId: null,
    competitionName: null,
    competitionYear: null,
    projectName: null,
    phaseName: null,
  }

  if (task.parent.type === "phases") {
    return resolvePhaseContext(
      task.parent.id,
      phaseById,
      competitionById,
      projectById
    )
  }

  let parent: Doc<"tasks">["parent"] = task.parent
  while (parent.type === "tasks") {
    const parentTask = taskById.get(parent.id)
    if (!parentTask) break
    parent = parentTask.parent
  }

  if (parent.type !== "phases") {
    return empty
  }

  return resolvePhaseContext(parent.id, phaseById, competitionById, projectById)
}

function groupDirectChildrenByParentId(tasks: Doc<"tasks">[]) {
  const childrenByParentId = new Map<Id<"tasks">, Doc<"tasks">[]>()

  for (const task of tasks) {
    if (task.parent.type !== "tasks") continue

    const siblings = childrenByParentId.get(task.parent.id) ?? []
    siblings.push(task)
    childrenByParentId.set(task.parent.id, siblings)
  }

  for (const children of childrenByParentId.values()) {
    children.sort((a, b) => a.order.localeCompare(b.order))
  }

  return childrenByParentId
}

async function buildDirectSubtaskViewsByParentId(
  statusLoader: TaskStatusLoader,
  taskById: Map<Id<"tasks">, Doc<"tasks">>,
  childrenByParentId: Map<Id<"tasks">, Doc<"tasks">[]>
) {
  const directSubtaskViewsByParentId = new Map<
    Id<"tasks">,
    TaskWithStatusView[]
  >()

  await Promise.all(
    [...childrenByParentId.entries()].map(async ([parentId, children]) => {
      const parent = taskById.get(parentId)
      if (!parent) return

      directSubtaskViewsByParentId.set(
        parentId,
        await buildSubtasksWithStatusViews(statusLoader, parent, children)
      )
    })
  )

  return directSubtaskViewsByParentId
}

export const listForBoard = query({
  args: {},
  returns: v.array(taskBoardRow),
  handler: async (ctx) => {
    const principal = await requirePrincipal(ctx)
    const competitions = await collectAll(ctx, "competitions")

    if (canPerform(principal, "manage", "Task")) {
      return await buildTaskBoardRows(ctx, { competitions })
    }

    const projects = await collectAll(ctx, "projects")
    const readableCompetitions = competitions.filter((competition) =>
      canPerform(principal, "read", "Competition", competition)
    )
    const readableProjects = []
    for (const project of projects) {
      if (await canReadProject(ctx, principal, project)) {
        readableProjects.push(project)
      }
    }

    const [tasks, phases] = await Promise.all([
      listTasksForRoots(
        ctx,
        readableCompetitions.map((competition) => competition._id),
        readableProjects.map((project) => project._id)
      ),
      collectAll(ctx, "phases"),
    ])

    return await buildTaskBoardRows(ctx, {
      tasks,
      phases,
      competitions: readableCompetitions,
      projects: readableProjects,
    })
  },
})

async function listTasksForRoots(
  ctx: QueryCtx,
  competitionIds: Id<"competitions">[],
  projectIds: Id<"projects">[]
) {
  const roots = [
    ...competitionIds.map((id) => ({ type: "competitions", id }) as const),
    ...projectIds.map((id) => ({ type: "projects", id }) as const),
  ]
  const taskIdSets = await Promise.all(
    roots.map((root) => listRootTaskIds(ctx, root))
  )
  const taskIds = new Set(taskIdSets.flat())

  const tasks = await Promise.all(
    [...taskIds].map((taskId) => ctx.db.get("tasks", taskId))
  )
  return tasks.filter((task): task is Doc<"tasks"> => task !== null)
}

export async function buildTaskBoardRows(
  ctx: QueryCtx,
  input?: {
    tasks?: Doc<"tasks">[]
    phases?: Doc<"phases">[]
    competitions?: Doc<"competitions">[]
    projects?: Doc<"projects">[]
  }
) {
  const [tasks, phases, competitions, projects] = await Promise.all([
    input?.tasks ?? collectAll(ctx, "tasks"),
    input?.phases ?? collectAll(ctx, "phases"),
    input?.competitions ?? collectAll(ctx, "competitions"),
    input?.projects ?? collectAll(ctx, "projects"),
  ])
  const taskById = new Map(tasks.map((task) => [task._id, task]))
  const phaseById = new Map(phases.map((phase) => [phase._id, phase]))
  const competitionById = new Map(
    competitions.map((competition) => [competition._id, competition])
  )
  const projectById = new Map(projects.map((project) => [project._id, project]))
  const statusLoader = new TaskStatusLoader(ctx)
  const blockersLoader = new TaskBlockersLoader(ctx)
  const displayReader = createTaskViewDisplayReader(ctx, {
    blockersLoader,
    statusLoader,
  })
  const childrenByParentId = groupDirectChildrenByParentId(tasks)
  const directSubtaskViewsByParentId = await buildDirectSubtaskViewsByParentId(
    statusLoader,
    taskById,
    childrenByParentId
  )

  return await Promise.all(
    tasks.map(async (task) => {
      const statusView = await buildTaskStatusViewWithFlowPosition(
        statusLoader,
        task
      )
      const details = await displayReader.hydrateTaskDetails({
        task,
        statusView,
        directSubtaskViews: directSubtaskViewsByParentId.get(task._id),
      })
      const rootContext = getTaskRootDisplayContext(
        task,
        taskById,
        phaseById,
        competitionById,
        projectById
      )

      return {
        ...details,
        path: buildFlatTaskInlinePath(task, taskById, statusView),
        competitionId: rootContext.competitionId,
        projectId: rootContext.projectId,
        phaseId: rootContext.phaseId,
        competitionName: rootContext.competitionName,
        competitionYear: rootContext.competitionYear,
        projectName: rootContext.projectName,
        phaseName: rootContext.phaseName,
      }
    })
  )
}
