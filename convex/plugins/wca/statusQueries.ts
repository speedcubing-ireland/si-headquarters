import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { requireCompetitionForRead } from "@/convex/competitions/access"
import { WCA_MILESTONES } from "@/convex/phases/wcaMilestones"
import { wcaMilestone } from "@/convex/phases/validators"
import { listPhasesForOwnerBounded } from "@/convex/phases/model"
import { loadMappings } from "@/convex/phases/wcaMappingModel"
import { reachedMilestones } from "@/convex/plugins/wca/competitionStatus"
import { getCurrentLinkIssue } from "@/convex/plugins/wca/linkIssues"
import { wcaRenameCandidateValidator } from "@/convex/plugins/wca/validators"

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
      /**
       * Set when the WCA answers 404 for the linked id, usually because the
       * competition was renamed there. `mayBeHidden` says whether it may
       * instead be hidden from the connected WCA account. The other fields
       * then describe the last time the link worked.
       */
      linkIssue: v.union(
        v.null(),
        v.object({
          detectedAt: v.number(),
          renameCandidate: v.union(wcaRenameCandidateValidator, v.null()),
          mayBeHidden: v.boolean(),
        })
      ),
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

    const [status, issue] = await Promise.all([
      ctx.db
        .query("wcaCompetitionStatuses")
        .withIndex("by_wcaCompetitionId", (q) =>
          q.eq("wcaCompetitionId", wcaCompetitionId)
        )
        .unique(),
      getCurrentLinkIssue(ctx, competition),
    ])
    const linkIssue =
      issue === null
        ? null
        : {
            detectedAt: issue.detectedAt,
            renameCandidate: issue.renameCandidate,
            mayBeHidden: issue.mayBeHidden,
          }

    if (status === null) {
      return {
        wcaCompetitionId,
        cancelled: competition.cancelledAt !== undefined,
        fetchedAt: null,
        reached: [],
        unmapped: [],
        linkIssue,
      }
    }

    const reached = reachedMilestones(status, Date.now())
    const [mappings, phases] = await Promise.all([
      loadMappings(ctx),
      listPhasesForOwnerBounded(ctx, {
        type: "competitions",
        id: args.competitionId,
      }),
    ])
    const templateKeys = new Set(
      phases
        .map((phase) => phase.templateKey)
        .filter((key): key is string => key !== undefined)
    )

    // Only milestones whose mapped phase this competition is missing. A
    // milestone deliberately left unmapped is a choice, not a problem — and
    // since the template maps nothing to `confirmed`, reporting those would
    // put a permanent warning on every competition.
    const unmapped = mappings
      .filter(
        (mapping) =>
          reached.has(mapping.milestone) &&
          mapping.phaseKey !== null &&
          !templateKeys.has(mapping.phaseKey)
      )
      .map((mapping) => mapping.milestone)

    return {
      wcaCompetitionId,
      cancelled: status.cancelled,
      fetchedAt: status.fetchedAt,
      reached: WCA_MILESTONES.filter((milestone) => reached.has(milestone)),
      unmapped,
      linkIssue,
    }
  },
})
