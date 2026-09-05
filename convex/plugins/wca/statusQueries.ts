import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { requireCompetitionForRead } from "@/convex/competitions/access"
import { WCA_MILESTONES } from "@/convex/phases/wcaMilestones"
import { wcaMilestone } from "@/convex/phases/validators"
import {
  DEFAULT_COMPETITION_TEMPLATE_KEY,
  loadMappingsForTemplate,
} from "@/convex/phases/wcaMappingModel"
import { reachedMilestones } from "@/convex/plugins/wca/competitionStatus"

/**
 * What the WCA last told us about a competition, and what the phase sync makes
 * of it. Drives the WCA row on the competition page.
 */
export const getForCompetition = query({
  args: {
    competitionId: v.id("competitions"),
  },
  returns: v.union(
    v.null(),
    v.object({
      wcaCompetitionId: v.string(),
      cancelled: v.boolean(),
      fetchedAt: v.union(v.number(), v.null()),
      /** Milestones reached, furthest last. Empty until the first sync. */
      reached: v.array(wcaMilestone),
      /**
       * Milestones the WCA has reached that no phase on this competition
       * covers, so the sync cannot act on them.
       */
      unmapped: v.array(wcaMilestone),
    })
  ),
  handler: async (ctx, args) => {
    const { competition } = await requireCompetitionForRead(
      ctx,
      args.competitionId
    )
    const wcaCompetitionId = competition.wcaCompetitionId
    if (wcaCompetitionId === undefined || wcaCompetitionId.length === 0) {
      return null
    }

    const status = await ctx.db
      .query("wcaCompetitionStatuses")
      .withIndex("by_wcaCompetitionId", (q) =>
        q.eq("wcaCompetitionId", wcaCompetitionId)
      )
      .unique()

    if (status === null) {
      return {
        wcaCompetitionId,
        cancelled: competition.cancelledAt !== undefined,
        fetchedAt: null,
        reached: [],
        unmapped: [],
      }
    }

    const reached = reachedMilestones(status, Date.now())
    const mappings = await loadMappingsForTemplate(
      ctx,
      DEFAULT_COMPETITION_TEMPLATE_KEY
    )
    const phases = await ctx.db
      .query("phases")
      .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
        q.eq("owner.type", "competitions").eq("owner.id", args.competitionId)
      )
      .collect()
    const templateKeys = new Set(
      phases
        .map((phase) => phase.templateKey)
        .filter((key): key is string => key !== undefined)
    )

    const unmapped = mappings
      .filter(
        (mapping) =>
          reached.has(mapping.milestone) &&
          (mapping.phaseKey === null || !templateKeys.has(mapping.phaseKey))
      )
      .map((mapping) => mapping.milestone)

    return {
      wcaCompetitionId,
      cancelled: status.cancelled,
      fetchedAt: status.fetchedAt,
      reached: WCA_MILESTONES.filter((milestone) => reached.has(milestone)),
      unmapped,
    }
  },
})
