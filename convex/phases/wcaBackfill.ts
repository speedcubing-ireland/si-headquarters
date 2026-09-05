import { v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
import { DEFAULT_COMPETITION_TEMPLATE_KEY } from "@/convex/phases/wcaMappingModel"
import { getCompetitionTemplate } from "@/convex/templates/registry"

const MAX_PHASES_PER_BATCH = 500

/**
 * Backfills `templateKey` on phase rows created before it existed, matching on
 * the template's phase names.
 *
 * Run once after deploying:
 *   bunx convex run phases/wcaBackfill:backfillPhaseTemplateKeys
 *
 * Renamed phases stay unmatched on purpose — guessing would silently point the
 * WCA sync at the wrong phase. Those are set by hand, or left out of the sync.
 */
export const backfillPhaseTemplateKeys = internalMutation({
  args: {
    templateKey: v.optional(v.string()),
    /** Report what would change without writing anything. */
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    matched: v.number(),
    unmatched: v.array(v.string()),
    alreadySet: v.number(),
  }),
  handler: async (ctx, args) => {
    const templateKey = args.templateKey ?? DEFAULT_COMPETITION_TEMPLATE_KEY
    const template = getCompetitionTemplate(templateKey)
    if (template === null) {
      throw new Error(`Unknown competition template "${templateKey}".`)
    }

    const keyByName = new Map(
      template.phases.map((phase) => [
        phase.name.trim().toLowerCase(),
        phase.key,
      ])
    )

    const phases = await ctx.db
      .query("phases")
      .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
        q.eq("owner.type", "competitions")
      )
      .take(MAX_PHASES_PER_BATCH + 1)

    if (phases.length > MAX_PHASES_PER_BATCH) {
      throw new Error(
        "Too many phases to backfill in one batch. Raise MAX_PHASES_PER_BATCH or page this."
      )
    }

    let matched = 0
    let alreadySet = 0
    const unmatched: string[] = []

    for (const phase of phases) {
      if (phase.templateKey !== undefined) {
        alreadySet += 1
        continue
      }

      const key = keyByName.get(phase.name.trim().toLowerCase())
      if (key === undefined) {
        unmatched.push(phase.name)
        continue
      }

      if (args.dryRun !== true) {
        await ctx.db.patch("phases", phase._id, { templateKey: key })
      }
      matched += 1
    }

    return { matched, unmatched: [...new Set(unmatched)], alreadySet }
  },
})
