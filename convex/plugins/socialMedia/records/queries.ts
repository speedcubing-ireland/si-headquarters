import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { requireSocialMediaDashboardAccess } from "@/convex/permissions/principal"
import { groupByCompetition } from "@/convex/plugins/socialMedia/records/collect"
import { findHqLink } from "@/convex/plugins/socialMedia/resolveHqLinks"
import { wcaRecordDocValidator } from "@/convex/plugins/socialMedia/validators"

/** More than a year of one country's records. */
const MAX_RECORDS = 2000

const recordsCompetitionValidator = v.object({
  liveCompetitionId: v.string(),
  wcaCompetitionId: v.string(),
  competitionName: v.string(),
  competitionEndDate: v.string(),
  hqCompetitionId: v.union(v.id("competitions"), v.null()),
  records: v.array(wcaRecordDocValidator),
})

/**
 * The stored records from competitions that ended on or after `since`, grouped
 * by competition, the latest-ending first (then by name), each linked to its HQ
 * competition if any.
 */
export const list = query({
  args: { since: v.string() },
  returns: v.array(recordsCompetitionValidator),
  handler: async (ctx, args) => {
    await requireSocialMediaDashboardAccess(ctx)

    const rows = await ctx.db
      .query("wcaRecords")
      .withIndex("by_competitionEndDate", (q) =>
        q.gte("competitionEndDate", args.since)
      )
      .order("desc")
      .take(MAX_RECORDS)

    return await Promise.all(
      groupByCompetition(rows)
        // A stable sort, so competitions ending the same day stay in name order.
        .sort((a, b) =>
          b.competitionEndDate.localeCompare(a.competitionEndDate)
        )
        .map(async (competition) => {
          const link = await findHqLink(ctx, competition.wcaCompetitionId)
          return {
            ...competition,
            hqCompetitionId: link?.competitionId ?? null,
          }
        })
    )
  },
})
