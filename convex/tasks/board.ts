import type { Doc, Id } from "@/convex/_generated/dataModel"
import { query } from "@/convex/_generated/server"
import { requireUserId } from "@/convex/lib/requireUser"
import {
  buildFlatTaskInlinePath,
  taskInlineRow,
} from "@/convex/tasks/inlineRow"
import { TaskBlockersLoader } from "@/convex/tasks/blockers/loader"
import {
  buildTaskStatusViewWithFlowPosition,
  TaskStatusLoader,
} from "@/convex/tasks/status/resolver"
import { createTaskViewDisplayReader } from "@/convex/tasks/view"
import { v } from "convex/values"

export const taskBoardRow = v.object({
  ...taskInlineRow.fields,
  competitionId: v.union(v.id("competitions"), v.null()),
  phaseId: v.union(v.id("phases"), v.null()),
  competitionName: v.union(v.string(), v.null()),
  competitionYear: v.union(v.number(), v.null()),
  phaseName: v.union(v.string(), v.null()),
})

interface TaskCompetitionContext {
  competitionId: Id<"competitions"> | null
  phaseId: Id<"phases"> | null
  competitionName: string | null
  competitionYear: number | null
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
  competitionById: Map<Id<"competitions">, Doc<"competitions">>
): TaskCompetitionContext {
  const phase = phaseById.get(phaseId)
  if (!phase) {
    return {
      competitionId: null,
      phaseId: null,
      competitionName: null,
      competitionYear: null,
      phaseName: null,
    }
  }
  const competition = competitionById.get(phase.owner.id)
  return {
    competitionId: phase.owner.id,
    phaseId: phase._id,
    competitionName: competition?.name ?? null,
    competitionYear: getCompetitionYear(competition),
    phaseName: phase.name,
  }
}

function getTaskCompetitionContext(
  task: Doc<"tasks">,
  taskById: Map<Id<"tasks">, Doc<"tasks">>,
  phaseById: Map<Id<"phases">, Doc<"phases">>,
  competitionById: Map<Id<"competitions">, Doc<"competitions">>
): TaskCompetitionContext {
  const empty: TaskCompetitionContext = {
    competitionId: null,
    phaseId: null,
    competitionName: null,
    competitionYear: null,
    phaseName: null,
  }

  if (task.parent.type === "phases") {
    return resolvePhaseContext(task.parent.id, phaseById, competitionById)
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

  return resolvePhaseContext(parent.id, phaseById, competitionById)
}

export const listForBoard = query({
  args: {},
  returns: v.array(taskBoardRow),
  handler: async (ctx) => {
    await requireUserId(ctx)

    // Full-table scans; acceptable at current HQ scale.
    const [tasks, phases, competitions] = await Promise.all([
      ctx.db.query("tasks").collect(),
      ctx.db.query("phases").collect(),
      ctx.db.query("competitions").collect(),
    ])
    const taskById = new Map(tasks.map((task) => [task._id, task]))
    const phaseById = new Map(phases.map((phase) => [phase._id, phase]))
    const competitionById = new Map(
      competitions.map((competition) => [competition._id, competition])
    )
    const statusLoader = new TaskStatusLoader(ctx)
    const blockersLoader = new TaskBlockersLoader(ctx)
    const displayReader = createTaskViewDisplayReader(ctx, {
      blockersLoader,
      statusLoader,
    })

    return await Promise.all(
      tasks.map(async (task) => {
        const statusView = await buildTaskStatusViewWithFlowPosition(
          statusLoader,
          task
        )
        const [details, competitionContext] = await Promise.all([
          displayReader.hydrateTaskDetails({ task, statusView }),
          Promise.resolve(
            getTaskCompetitionContext(
              task,
              taskById,
              phaseById,
              competitionById
            )
          ),
        ])

        return {
          ...details,
          path: buildFlatTaskInlinePath(task, taskById, statusView),
          competitionId: competitionContext.competitionId,
          phaseId: competitionContext.phaseId,
          competitionName: competitionContext.competitionName,
          competitionYear: competitionContext.competitionYear,
          phaseName: competitionContext.phaseName,
        }
      })
    )
  },
})
