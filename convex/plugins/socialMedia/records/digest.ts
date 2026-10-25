"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction } from "@/convex/_generated/server"
import { competitionCountryIso2 } from "@/config/lib/organisation"
import { createPublicWcaClient } from "@/convex/plugins/wca/client"
import { collectWeeklyRecords } from "@/convex/plugins/socialMedia/records/collect"
import {
  countRecords,
  renderWeeklyRecordsEmail,
} from "@/convex/plugins/socialMedia/records/email"
import { weekWindowStartingOn } from "@/convex/plugins/socialMedia/records/window"

/**
 * Builds and sends the Social Media Team's email of the NRs, CRs and WRs set by
 * competitors from the organisation's country at competitions whose results the
 * WCA posted in the week starting on `weekStart`, or an email saying there were
 * none.
 *
 * Queued by `digestState.queueWeeklyDigest`; to send a week by hand, run that
 * mutation with a Monday `nowMs`. Only the WCA's public endpoints are used, so a
 * disconnected WCA service account does not stop it.
 */
export const sendWeeklyRecordsDigest = internalAction({
  args: { weekStart: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const countryIso2 = competitionCountryIso2()
      const window = weekWindowStartingOn(args.weekStart)
      const competitions = await collectWeeklyRecords(
        createPublicWcaClient(),
        countryIso2,
        window
      )
      const email = await renderWeeklyRecordsEmail(
        competitions,
        countryIso2,
        window
      )
      await ctx.runMutation(
        internal.plugins.socialMedia.records.digestState.deliver,
        {
          weekStart: args.weekStart,
          ...email,
          recordCount: countRecords(competitions),
        }
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
