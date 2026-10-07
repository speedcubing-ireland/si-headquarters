import { v } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { internalMutation, type MutationCtx } from "@/convex/_generated/server"
import { getLastTaskOrder } from "@/convex/tasks/hierarchy"
import { manualIntent } from "@/convex/tasks/status/rules"
import {
  backfillOutcomeValidator,
  findTemplatePhase,
  findTemplateTask,
  loadBackfillCompetitions,
  loadInFlightCompetitionPhases,
  matchesTemplatePhase,
  normalizeName,
  type BackfillOutcome,
} from "@/convex/templates/backfillHelpers"
import { insertTemplateTasksIntoPhase } from "@/convex/templates/resolver"

const PHASE_KEY = "post-competition"
const TASK_KEY = "pay-venue-balance"

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
 * Completed phase is considered; cancelled competitions are skipped. Run it from the Convex dashboard (Functions →
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
    skipped: v.array(backfillOutcomeValidator),
  }),
  handler: async (ctx, args) => {
    const templatePhase = findTemplatePhase(PHASE_KEY)
    const templateTask = findTemplateTask(templatePhase, TASK_KEY)

    const added: Id<"competitions">[] = []
    const skipped: BackfillOutcome[] = []

    for (const competition of await loadBackfillCompetitions(
      ctx,
      args.competitionIds,
      skipped
    )) {
      const competitionId = competition._id

      const inFlight = await loadInFlightCompetitionPhases(ctx, competition)
      if (inFlight.skipReason !== null) {
        skipped.push({ competitionId, reason: inFlight.skipReason })
        continue
      }
      const { phases } = inFlight

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
