"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction } from "@/convex/_generated/server"
import { competitionCountryIso2 } from "@/config/lib/organisation"
import {
  groupByCompetition,
  syncRecentRecords,
} from "@/convex/plugins/socialMedia/records/collect"
import { renderWeeklyRecordsEmail } from "@/convex/plugins/socialMedia/records/email"

/**
 * Builds and sends the Social Media Team's email of the NRs, CRs and WRs set by
 * competitors from the organisation's country at competitions that ended in the
 * week starting on `weekStart`, or an email saying there were none. Records come
 * from WCA Live as entered, before the WCA posts the results, and are synced
 * first so the email includes the last hour.
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
      const records = await ctx.runQuery(
        internal.plugins.socialMedia.records.store.forWeek,
        { weekStart: args.weekStart }
      )
      const email = await renderWeeklyRecordsEmail(
        groupByCompetition(records),
        competitionCountryIso2(),
        args.weekStart
      )
      await ctx.runMutation(
        internal.plugins.socialMedia.records.digestState.deliver,
        { weekStart: args.weekStart, ...email }
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
