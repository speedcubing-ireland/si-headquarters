import { v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { internalMutation, type MutationCtx } from "@/convex/_generated/server"
import { listPhasesForOwner } from "@/convex/phases/model"
import { getLastTaskOrder } from "@/convex/tasks/hierarchy"
import { manualIntent } from "@/convex/tasks/status/rules"
import {
  getTemplateOrThrow,
  type CompetitionTemplateTaskSpec,
} from "@/convex/templates/registry"
import { insertTemplateTasksIntoPhase } from "@/convex/templates/resolver"

const TEMPLATE_KEY = "standard-competition"
const PHASE_KEY = "pre-competition"
const TASK_KEY = "scrambles-generated"

const outcomeValidator = v.object({
  competitionId: v.id("competitions"),
  /** Why nothing was added, or what was added but incomplete. */
  reason: v.string(),
})

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

function findTemplatePhase() {
  const template = getTemplateOrThrow(TEMPLATE_KEY)
  const phase = template.phases.find((candidate) => candidate.key === PHASE_KEY)
  if (phase === undefined) {
    throw new Error(`Template phase "${PHASE_KEY}" no longer exists.`)
  }
  return phase
}

function findTemplateTask(
  phase: ReturnType<typeof findTemplatePhase>
): CompetitionTemplateTaskSpec {
  const task = phase.tasks?.find((candidate) => candidate.key === TASK_KEY)
  if (task === undefined) {
    throw new Error(`Template task "${TASK_KEY}" no longer exists.`)
  }
  return task
}

/**
 * Resolves a competition's Pre-Competition phase.
 *
 * `templateKey` is only set on rows that `phases/wcaBackfill` already matched,
 * so older competitions still need the phase-name fallback. A renamed phase
 * stays unmatched on purpose rather than being guessed at.
 */
async function findPreCompetitionPhase(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  templatePhaseName: string
): Promise<Doc<"phases"> | null> {
  const phases = await listPhasesForOwner(ctx, {
    type: "competitions",
    id: competitionId,
  })

  return (
    phases.find((phase) => phase.templateKey === PHASE_KEY) ??
    phases.find(
      (phase) => normalizeName(phase.name) === normalizeName(templatePhaseName)
    ) ??
    null
  )
}

function listPhaseRootTasks(ctx: MutationCtx, phaseId: Id<"phases">) {
  return ctx.db
    .query("tasks")
    .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
      q.eq("parent.type", "phases").eq("parent.id", phaseId)
    )
    .collect()
}

/**
 * Adds the Pre-Competition "Scrambles generated" task to competitions that were
 * created before it was part of the standard template.
 *
 * The competition ids are supplied by the caller — the ones at or before
 * Pre-Competition — so this does not try to work out which competitions qualify:
 *
 *   bunx convex run templates/scramblesBackfill:addScramblesTask \
 *     '{"competitionIds": ["<id>"], "dryRun": true}'
 *
 * Re-running is safe: a competition that already has the task is reported and
 * left alone.
 */
export const addScramblesTask = internalMutation({
  args: {
    competitionIds: v.array(v.id("competitions")),
    /** Report what would change without writing anything. */
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    added: v.number(),
    skipped: v.array(outcomeValidator),
    warnings: v.array(outcomeValidator),
  }),
  handler: async (ctx, args) => {
    const templatePhase = findTemplatePhase()
    const templateTask = findTemplateTask(templatePhase)
    const blockingTaskKey = templateTask.blockedBy?.[0] ?? null
    const blockingTaskName =
      blockingTaskKey === null
        ? null
        : (templatePhase.tasks?.find((task) => task.key === blockingTaskKey)
            ?.name ?? null)

    const skipped: { competitionId: Id<"competitions">; reason: string }[] = []
    const warnings: { competitionId: Id<"competitions">; reason: string }[] = []
    let added = 0

    for (const competitionId of args.competitionIds) {
      const competition = await ctx.db.get("competitions", competitionId)
      if (competition === null) {
        skipped.push({ competitionId, reason: "competition not found" })
        continue
      }

      const phase = await findPreCompetitionPhase(
        ctx,
        competitionId,
        templatePhase.name
      )
      if (phase === null) {
        skipped.push({
          competitionId,
          reason: `no "${templatePhase.name}" phase`,
        })
        continue
      }

      const phaseTasks = await listPhaseRootTasks(ctx, phase._id)
      if (
        phaseTasks.some(
          (task) =>
            normalizeName(task.name) === normalizeName(templateTask.name)
        )
      ) {
        skipped.push({ competitionId, reason: "already present" })
        continue
      }

      const blockingTask =
        blockingTaskName === null
          ? null
          : (phaseTasks.find(
              (task) =>
                normalizeName(task.name) === normalizeName(blockingTaskName)
            ) ?? null)
      if (blockingTaskName !== null && blockingTask === null) {
        warnings.push({
          competitionId,
          reason: `no "${blockingTaskName}" task to block on`,
        })
      }

      added += 1
      if (args.dryRun === true) continue

      const taskIdsByKey = await insertTemplateTasksIntoPhase(ctx, {
        after: await getLastTaskOrder(ctx, {
          type: "phases",
          id: phase._id,
        }),
        competition: {
          name: competition.name,
          description: competition.description,
          compDates: competition.compDates,
          people: competition.people,
        },
        phaseId: phase._id,
        tasks: [templateTask],
      })

      const taskId = taskIdsByKey.get(templateTask.key)
      if (taskId === undefined) {
        throw new Error(`Template task "${templateTask.key}" was not inserted.`)
      }

      // Template tasks are inserted in backlog and activated when their phase
      // becomes current. Patch only this task rather than reactivating the whole
      // phase, so tasks deliberately moved back to backlog stay there.
      if (competition.phaseId === phase._id) {
        await ctx.db.patch("tasks", taskId, {
          status: "to-do",
          statusIntent: manualIntent("to-do"),
        })
      }

      if (blockingTask !== null) {
        await ctx.db.insert("taskBlockers", {
          blockedTaskId: taskId,
          blockingTaskId: blockingTask._id,
        })
      }
    }

    return { added, skipped, warnings }
  },
})
