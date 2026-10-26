import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { requireSocialMediaDashboardAccess } from "@/convex/permissions/principal"
import { groupByCompetition } from "@/convex/plugins/socialMedia/records/collect"
import { findHqLink } from "@/convex/plugins/socialMedia/resolveHqLinks"
import { wcaRecordDocValidator } from "@/convex/plugins/socialMedia/validators"

/** More than the whole history of one country's records. */
const MAX_RECORDS = 4000

const recordsCompetitionValidator = v.object({
  liveCompetitionId: v.union(v.string(), v.null()),
  wcaCompetitionId: v.string(),
  competitionName: v.string(),
  competitionEndDate: v.string(),
  resultsPosted: v.boolean(),
  hqCompetitionId: v.union(v.id("competitions"), v.null()),
  records: v.array(wcaRecordDocValidator),
})

/**
 * The stored records from competitions that ended between `from` and `to`
 * (inclusive, either open), grouped by competition, the latest-ending first
 * (then by name), each linked to its HQ competition if any. `truncated` says
 * the range held more records than are returned, so the earliest are missing.
 */
export const list = query({
  args: { from: v.optional(v.string()), to: v.optional(v.string()) },
  returns: v.object({
    competitions: v.array(recordsCompetitionValidator),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireSocialMediaDashboardAccess(ctx)

    const { from, to } = args
    const rows = await ctx.db
      .query("wcaRecords")
      .withIndex("by_competitionEndDate", (q) => {
        const lower = from === undefined ? q : q.gte("competitionEndDate", from)
        return to === undefined ? lower : lower.lte("competitionEndDate", to)
      })
      .order("desc")
      .take(MAX_RECORDS + 1)
    const truncated = rows.length > MAX_RECORDS
    if (truncated) rows.pop()

    const competitions = await Promise.all(
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
    return { competitions, truncated }
  },
})
