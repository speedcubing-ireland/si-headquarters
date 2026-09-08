import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalMutation } from "@/convex/_generated/server"
import { standardCompetitionTemplate } from "@/convex/templates/registry"

const PHASES_PER_BATCH = 200

const backfillTallyValidator = v.object({
  matched: v.number(),
  unmatched: v.array(v.string()),
  alreadySet: v.number(),
})

/**
 * Backfills `templateKey` on phase rows created before it existed, matching on
 * the template's phase names.
 *
 * Run once after deploying:
 *   bunx convex run phases/wcaBackfill:backfillPhaseTemplateKeys
 *
 * Processes one page per invocation and reschedules itself until done, so the
 * number of competitions is not a ceiling — the earlier single-batch version
 * threw past ~83 competitions, which would have left `templateKey` unset and
 * silently reduced the whole WCA sync to a no-op.
 *
 * Renamed phases stay unmatched on purpose — guessing would silently point the
 * WCA sync at the wrong phase. Those are set by hand, or left out of the sync.
 */
export const backfillPhaseTemplateKeys = internalMutation({
  args: {
    /** Report what would change without writing anything. */
    dryRun: v.optional(v.boolean()),
    /** Continuation state; omit when starting a run. */
    cursor: v.optional(v.union(v.string(), v.null())),
    tally: v.optional(backfillTallyValidator),
  },
  returns: v.object({
    ...backfillTallyValidator.fields,
    /** False when another batch has been scheduled to continue. */
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const keyByName = new Map(
      standardCompetitionTemplate.phases.map((phase) => [
        phase.name.trim().toLowerCase(),
        phase.key,
      ])
    )

    const page = await ctx.db
      .query("phases")
      .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
        q.eq("owner.type", "competitions")
      )
      .paginate({ numItems: PHASES_PER_BATCH, cursor: args.cursor ?? null })

    let matched = args.tally?.matched ?? 0
    let alreadySet = args.tally?.alreadySet ?? 0
    const unmatched = new Set(args.tally?.unmatched ?? [])

    for (const phase of page.page) {
      if (phase.templateKey !== undefined) {
        alreadySet += 1
        continue
      }

      const key = keyByName.get(phase.name.trim().toLowerCase())
      if (key === undefined) {
        unmatched.add(phase.name)
        continue
      }

      if (args.dryRun !== true) {
        await ctx.db.patch("phases", phase._id, { templateKey: key })
      }
      matched += 1
    }

    const tally = { matched, unmatched: [...unmatched], alreadySet }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.phases.wcaBackfill.backfillPhaseTemplateKeys,
        { dryRun: args.dryRun, cursor: page.continueCursor, tally }
      )
    }

    // On a multi-page run the returned tally covers the batches so far; the
    // final scheduled batch logs the complete figures.
    return { ...tally, isDone: page.isDone }
  },
})
