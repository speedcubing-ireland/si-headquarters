import { v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { internalMutation, type MutationCtx } from "@/convex/_generated/server"
import { listPhasesForOwnerBounded } from "@/convex/phases/model"
import { getLastTaskOrder } from "@/convex/tasks/hierarchy"
import { manualIntent } from "@/convex/tasks/status/rules"
import {
  getTemplateOrThrow,
  type CompetitionTemplateTaskSpec,
} from "@/convex/templates/registry"
import { insertTemplateTasksIntoPhase } from "@/convex/templates/resolver"

const TEMPLATE_KEY = "standard-competition"
const PHASE_KEY = "post-competition"
const COMPLETED_PHASE_KEY = "completed"
const TASK_KEY = "pay-venue-balance"

const outcomeValidator = v.object({
  competitionId: v.id("competitions"),
  /** Why nothing was added. */
  reason: v.string(),
})

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

function findTemplatePhase(key: string) {
  const template = getTemplateOrThrow(TEMPLATE_KEY)
  const phase = template.phases.find((candidate) => candidate.key === key)
  if (phase === undefined) {
    throw new Error(`Template phase "${key}" no longer exists.`)
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
 * Matches a competition phase to a template phase.
 *
 * `templateKey` is only set on rows that `phases/wcaBackfill` already matched,
 * so older competitions still need the phase-name fallback. A renamed phase
 * stays unmatched on purpose rather than being guessed at.
 */
function matchesTemplatePhase(
  phase: Doc<"phases">,
  templatePhase: { key: string; name: string }
): boolean {
  return (
    phase.templateKey === templatePhase.key ||
    (phase.templateKey === undefined &&
      normalizeName(phase.name) === normalizeName(templatePhase.name))
  )
}

async function hasTask(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  phaseId: Id<"phases">,
  taskName: string
): Promise<boolean> {
  const byTemplateKey = await ctx.db
    .query("tasks")
    .withIndex("by_root_type_and_root_id_and_templateKey", (q) =>
      q
        .eq("root.type", "competitions")
        .eq("root.id", competitionId)
        .eq("templateKey", TASK_KEY)
    )
    .first()
  if (byTemplateKey !== null) return true

  for await (const task of ctx.db
    .query("tasks")
    .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
      q.eq("parent.type", "phases").eq("parent.id", phaseId)
    )) {
    if (normalizeName(task.name) === normalizeName(taskName)) return true
  }
  return false
}

/**
 * Adds the Post-Competition "Pay Venue Balance" task to in-flight competitions
 * that were created before it was part of the standard template.
 *
 * With no `competitionIds`, every competition that is not already in its
 * Completed phase is considered. Run it from the Convex dashboard (Functions →
 * templates/payVenueBalanceBackfill:addPayVenueBalanceTask), first with
 * `{"dryRun": true}` to see what would change, then with `{}`.
 *
 * Re-running is safe: a competition that already has the task is reported and
 * left alone.
 */
export const addPayVenueBalanceTask = internalMutation({
  args: {
    /** Restrict the backfill to these competitions. */
    competitionIds: v.optional(v.array(v.id("competitions"))),
    /** Report what would change without writing anything. */
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    added: v.array(v.id("competitions")),
    skipped: v.array(outcomeValidator),
  }),
  handler: async (ctx, args) => {
    const templatePhase = findTemplatePhase(PHASE_KEY)
    const completedPhase = findTemplatePhase(COMPLETED_PHASE_KEY)
    const templateTask = findTemplateTask(templatePhase)

    const added: Id<"competitions">[] = []
    const skipped: { competitionId: Id<"competitions">; reason: string }[] = []

    const competitions: (Doc<"competitions"> | null)[] = []
    if (args.competitionIds === undefined) {
      for await (const competition of ctx.db.query("competitions")) {
        competitions.push(competition)
      }
    } else {
      for (const competitionId of args.competitionIds) {
        const competition = await ctx.db.get("competitions", competitionId)
        if (competition === null) {
          skipped.push({ competitionId, reason: "competition not found" })
        }
        competitions.push(competition)
      }
    }

    for (const competition of competitions) {
      if (competition === null) continue
      const competitionId = competition._id

      const phases = await listPhasesForOwnerBounded(ctx, {
        type: "competitions",
        id: competitionId,
      })
      const currentPhase =
        phases.find((phase) => phase._id === competition.phaseId) ?? null
      if (
        currentPhase !== null &&
        matchesTemplatePhase(currentPhase, completedPhase)
      ) {
        skipped.push({ competitionId, reason: "competition is completed" })
        continue
      }

      const phase =
        phases.find((candidate) =>
          matchesTemplatePhase(candidate, templatePhase)
        ) ?? null
      if (phase === null) {
        skipped.push({
          competitionId,
          reason: `no "${templatePhase.name}" phase`,
        })
        continue
      }

      if (await hasTask(ctx, competitionId, phase._id, templateTask.name)) {
        skipped.push({ competitionId, reason: "already present" })
        continue
      }

      added.push(competitionId)
      if (args.dryRun === true) continue

      const taskIdsByKey = await insertTemplateTasksIntoPhase(ctx, {
        after: await getLastTaskOrder(ctx, { type: "phases", id: phase._id }),
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
    }

    return { added, skipped }
  },
})
