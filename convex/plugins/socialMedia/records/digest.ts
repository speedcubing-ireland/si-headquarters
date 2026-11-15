"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction } from "@/convex/_generated/server"
import { competitionCountryIso2 } from "@/config/lib/organisation"
import {
  groupByCompetition,
  syncRecentRecords,
} from "@/convex/plugins/socialMedia/records/collect"
import { settlePostedResults } from "@/convex/plugins/socialMedia/records/confirm"
import {
  renderWeeklyRecordsEmail,
  type RenderedEmail,
} from "@/convex/plugins/socialMedia/records/email"

/**
 * Builds and sends the Social Media Team's email of the NRs, CRs and WRs set by
 * competitors from the organisation's country at competitions that ended in the
 * week starting on `weekStart`, or an email saying there were none. Records the
 * WCA has confirmed are listed apart from those still as WCA Live entered them.
 * WCA Live and the WCA's posted results are both read first, so the email
 * includes the last hour, and competitions WCA Live never had. A provisional
 * record is listed again as confirmed in the first email after the WCA posts
 * its competition's results, whichever week that competition ended in.
 *
 * Queued by `digestState.queueWeeklyDigest`; to send a week by hand, run that
 * mutation with a Monday `nowMs`. WCA Live's API is public, so a disconnected WCA
 * service account does not stop it.
 */
export const sendWeeklyRecordsDigest = internalAction({
  args: { weekStart: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await syncRecentRecords(ctx)
      await settlePostedResults(ctx)
      const confirmedThrough = Date.now()
      const { confirmed, provisional } = await ctx.runQuery(
        internal.plugins.socialMedia.records.digestState.recordsForEmail,
        { weekStart: args.weekStart, until: confirmedThrough }
      )
      const email = await renderWeeklyRecordsEmail(
        {
          confirmed: groupByCompetition(confirmed),
          provisional: groupByCompetition(provisional),
        },
        competitionCountryIso2(),
        args.weekStart
      )
      await ctx.runMutation(
        internal.plugins.socialMedia.records.digestState.deliver,
        { weekStart: args.weekStart, confirmedThrough, ...email }
      )
    } catch (error) {
      // Recorded rather than rethrown: the next hourly tick retries a failed
      // run, and the row says why it failed.
      console.error("Weekly records email failed", error)
      await ctx.runMutation(
        internal.plugins.socialMedia.records.digestState.recordFailure,
        {
          weekStart: args.weekStart,
          reason: error instanceof Error ? error.message : String(error),
        }
      )
    }
    return null
  },
})

/**
 * Builds the email for the week starting on `weekStart` as
 * `sendWeeklyRecordsDigest` would, without sending it or recording the run.
 * For checking an upcoming email by hand with `npx convex run`.
 */
export const previewWeeklyRecordsDigest = internalAction({
  args: { weekStart: v.string() },
  returns: v.object({
    subject: v.string(),
    html: v.string(),
    text: v.string(),
    recordCount: v.number(),
  }),
  handler: async (ctx, args): Promise<RenderedEmail> => {
    await syncRecentRecords(ctx)
    await settlePostedResults(ctx)
    const { confirmed, provisional } = await ctx.runQuery(
      internal.plugins.socialMedia.records.digestState.recordsForEmail,
      { weekStart: args.weekStart, until: Date.now() }
    )
    return await renderWeeklyRecordsEmail(
      {
        confirmed: groupByCompetition(confirmed),
        provisional: groupByCompetition(provisional),
      },
      competitionCountryIso2(),
      args.weekStart
    )
  },
})
