"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { env, internalAction } from "@/convex/_generated/server"
import { wcaCountryId } from "@/config/lib/organisation"
import { createPublicWcaClient } from "@/convex/plugins/wca/client"
import { collectWeeklyRecords } from "@/convex/plugins/socialMedia/records/collect"
import { renderWeeklyRecordsEmail } from "@/convex/plugins/socialMedia/records/email"
import { weekWindowStartingOn } from "@/convex/plugins/socialMedia/records/window"

export function parseRecipients(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => address.length > 0)
}

/**
 * Builds and sends the Social Media Team's email of the Irish NRs, CRs and WRs
 * from competitions whose results the WCA posted in the week starting on
 * `weekStart`, or an email saying there were none.
 *
 * Queued by `digestState.queueWeeklyDigest`, which claims the attempt it
 * passes; to send a week by hand, run that mutation with a Monday `nowMs`.
 * Only the WCA's public endpoints are used, so a disconnected WCA service
 * account does not stop it.
 */
export const sendWeeklyRecordsDigest = internalAction({
  args: { weekStart: v.string(), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const finish = async (status: "failed" | "skipped", reason: string) => {
      await ctx.runMutation(
        internal.plugins.socialMedia.records.digestState.finishWithoutSending,
        { weekStart: args.weekStart, attempt: args.attempt, status, reason }
      )
    }

    const to = parseRecipients(env.SOCIAL_MEDIA_RECORDS_EMAIL_TO)
    const from = env.SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS?.trim() ?? ""
    const countryId = wcaCountryId()
    const missing = [
      ...(to.length === 0 ? ["SOCIAL_MEDIA_RECORDS_EMAIL_TO"] : []),
      ...(from === "" ? ["SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS"] : []),
      ...(countryId === null
        ? ["wca.countryId in the organisation config"]
        : []),
    ]
    if (countryId === null || missing.length > 0) {
      const reason = `Weekly records email not configured: set ${missing.join(", ")}.`
      console.warn(reason)
      await finish("skipped", reason)
      return null
    }

    try {
      const window = weekWindowStartingOn(args.weekStart)
      const records = await collectWeeklyRecords(
        createPublicWcaClient(),
        countryId,
        window
      )
      const email = await renderWeeklyRecordsEmail(records, window)
      await ctx.runMutation(
        internal.plugins.socialMedia.records.digestState.deliver,
        {
          weekStart: args.weekStart,
          attempt: args.attempt,
          from,
          to,
          ...email,
          recordCount: records.length,
        }
      )
    } catch (error) {
      // Recorded rather than rethrown: the next hourly tick retries a failed
      // run, and the row says why it failed.
      console.error("Weekly records email failed", error)
      await finish(
        "failed",
        error instanceof Error ? error.message : String(error)
      )
    }
    return null
  },
})
