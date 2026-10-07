import { v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { internalMutation, type MutationCtx } from "@/convex/_generated/server"
import { insertTaskIntegrationIfMissing } from "@/convex/integrations/taskIntegrations/mutations"
import { LEGACY_TASK_INTEGRATION_IDS } from "@/convex/integrations/taskIntegrations/constants"
import { COMPLETION_TASK_STATUSES } from "@/convex/tasks/status/validators"
import {
  backfillOutcomeValidator,
  findTemplatePhase,
  findTemplateTask,
  loadBackfillCompetitions,
  loadInFlightCompetitionPhases,
  normalizeName,
  type BackfillOutcome,
} from "@/convex/templates/backfillHelpers"
import { BADGES_READY_TASK_TEMPLATE_KEY } from "@/convex/templates/registry"

const PHASE_KEY = "pre-competition"
const OLD_TASK_KEY = "check-in-sheet-ready"
const OLD_TASK_NAME = "Check-in sheet ready"
const [CHECKIN_INTEGRATION_ID] = LEGACY_TASK_INTEGRATION_IDS

const completionStatuses = new Set<string>(COMPLETION_TASK_STATUSES)

/**
 * The competition's "Check-in sheet ready" subtask, matched by template key or,
 * for competitions created before tasks carried one, by name.
 */
async function findCheckInSheetTask(
  ctx: MutationCtx,
  competitionId: Id<"competitions">
): Promise<Doc<"tasks"> | null> {
  const byTemplateKey = await ctx.db
    .query("tasks")
    .withIndex("by_root_type_and_root_id_and_templateKey", (q) =>
      q
        .eq("root.type", "competitions")
        .eq("root.id", competitionId)
        .eq("templateKey", OLD_TASK_KEY)
    )
    .first()
  if (byTemplateKey !== null) return byTemplateKey

  for await (const task of ctx.db
    .query("tasks")
    .withIndex("by_root_type_and_root_id_and_templateKey", (q) =>
      q
        .eq("root.type", "competitions")
        .eq("root.id", competitionId)
        .eq("templateKey", undefined)
    )) {
    if (normalizeName(task.name) === normalizeName(OLD_TASK_NAME)) return task
  }
  return null
}

async function deleteCheckInIntegrations(
  ctx: MutationCtx,
  taskId: Id<"tasks">
): Promise<void> {
  const rows = await ctx.db
    .query("taskIntegrations")
    .withIndex("by_taskId_and_integrationId", (q) =>
      q.eq("taskId", taskId).eq("integrationId", CHECKIN_INTEGRATION_ID)
    )
    .collect()
  for (const row of rows) {
    await ctx.db.delete("taskIntegrations", row._id)
  }
}

/**
 * Turns the Groups Ready "Check-in sheet ready" subtask into "Badges ready",
 * which links to the competition's page on SI Achievements instead of
 * populating a Google check-in sheet.
 *
 * With no `competitionIds`, every competition that is not cancelled or already
 * in its Completed phase is considered. Subtasks that are already completed are
 * left as they are. Run it from the Convex dashboard (Functions →
 * templates/badgesReadyBackfill:replaceCheckInSheetWithBadges), first with
 * `{"dryRun": true}` to see what would change, then with `{}`.
 *
 * Re-running is safe: once converted, a competition no longer has the old
 * subtask and is reported as skipped.
 */
export const replaceCheckInSheetWithBadges = internalMutation({
  args: {
    /** Restrict the backfill to these competitions. */
    competitionIds: v.optional(v.array(v.id("competitions"))),
    /** Report what would change without writing anything. */
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    updated: v.array(v.id("competitions")),
    skipped: v.array(backfillOutcomeValidator),
  }),
  handler: async (ctx, args) => {
    const templateTask = findTemplateTask(
      findTemplatePhase(PHASE_KEY),
      BADGES_READY_TASK_TEMPLATE_KEY
    )

    const updated: Id<"competitions">[] = []
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

      const task = await findCheckInSheetTask(ctx, competitionId)
      if (task === null) {
        skipped.push({ competitionId, reason: `no "${OLD_TASK_NAME}" task` })
        continue
      }
      if (completionStatuses.has(task.status)) {
        skipped.push({
          competitionId,
          reason: `"${OLD_TASK_NAME}" is already ${task.status}`,
        })
        continue
      }

      updated.push(competitionId)
      if (args.dryRun === true) continue

      await ctx.db.patch("tasks", task._id, {
        name: templateTask.name,
        description: templateTask.description ?? null,
        templateKey: templateTask.key,
      })
      await deleteCheckInIntegrations(ctx, task._id)
      for (const integrationId of templateTask.integrationIds ?? []) {
        await insertTaskIntegrationIfMissing(ctx, task._id, integrationId)
      }
    }

    return { updated, skipped }
  },
})

/**
 * Deletes every remaining "Populate check-in sheet" integration row, including
 * those on completed tasks that `replaceCheckInSheetWithBadges` leaves alone.
 * The integration no longer exists, so these rows are hidden and inert; once
 * this has run, `sheet.populate-checkin` can be dropped from
 * `LEGACY_TASK_INTEGRATION_IDS`.
 *
 * Run it from the Convex dashboard after `replaceCheckInSheetWithBadges`, first
 * with `{"dryRun": true}`.
 */
export const deleteLegacyCheckInIntegrations = internalMutation({
  args: {
    /** Report how many rows would be deleted without deleting them. */
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    let deleted = 0
    // One-off cleanup: there is no index on `integrationId` alone and the
    // table is small, so scan it once.
    for await (const row of ctx.db.query("taskIntegrations")) {
      if (row.integrationId !== CHECKIN_INTEGRATION_ID) continue
      deleted += 1
      if (args.dryRun !== true) {
        await ctx.db.delete("taskIntegrations", row._id)
      }
    }
    return { deleted }
  },
})
