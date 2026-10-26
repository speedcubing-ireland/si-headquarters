import type { WithoutSystemFields } from "convex/server"
import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  env,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "@/convex/_generated/server"
import {
  competitionCountryIso2,
  isFeatureEnabled,
} from "@/config/lib/organisation"
import { isConfiguredLocalTimeInWindow } from "@/convex/notifications/localTime"
import { resend } from "@/convex/sendEmails"
import { weekToReport } from "@/convex/plugins/socialMedia/records/window"
import { wcaRecordDocValidator } from "@/convex/plugins/socialMedia/validators"

/** Local hour on Monday from which the email may go out. */
export const RECORD_DIGEST_SEND_HOUR = 8

/** Failed attempts per week before the run is left for someone to look at. */
export const RECORD_DIGEST_MAX_ATTEMPTS = 5

/** Far more records than the WCA confirms for one country between emails. */
const MAX_CONFIRMED_ROWS = 1000

type DigestRun = Doc<"socialMediaRecordDigestRuns">

function parseRecipients(value: string): string[] {
  return value
    .split(",")
    .map((address) => address.trim())
    .filter((address) => address.length > 0)
}

async function getRun(
  ctx: MutationCtx,
  weekStart: string
): Promise<DigestRun | null> {
  return await ctx.db
    .query("socialMediaRecordDigestRuns")
    .withIndex("by_weekStart", (q) => q.eq("weekStart", weekStart))
    .unique()
}

/** Writes the week's row whole, so a sent run keeps no stale failure fields. */
async function saveRun(
  ctx: MutationCtx,
  run: DigestRun | null,
  fields: WithoutSystemFields<DigestRun>
): Promise<void> {
  if (run === null) {
    await ctx.db.insert("socialMediaRecordDigestRuns", fields)
  } else {
    await ctx.db.replace("socialMediaRecordDigestRuns", run._id, fields)
  }
}

/**
 * Cron entry point, ticking hourly so the local-time gate alone decides when the
 * email goes out, whatever the configured timezone. From the send hour on a
 * local Monday, queues the action that builds and sends the previous week's
 * email until a run is sent or has failed too often. Overlapping actions are
 * harmless: `deliver` is the one place that sends, and it sends a week once.
 */
export const queueWeeklyDigest = internalMutation({
  args: { nowMs: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!isFeatureEnabled("records")) return null

    const nowMs = args.nowMs ?? Date.now()
    const weekStart = weekToReport(nowMs)
    if (
      weekStart === null ||
      !isConfiguredLocalTimeInWindow(RECORD_DIGEST_SEND_HOUR, 24, nowMs)
    ) {
      return null
    }

    const run = await getRun(ctx, weekStart)
    if (
      run?.status === "sent" ||
      (run?.failures ?? 0) >= RECORD_DIGEST_MAX_ATTEMPTS
    ) {
      return null
    }

    await ctx.scheduler.runAfter(
      0,
      internal.plugins.socialMedia.records.digest.sendWeeklyRecordsDigest,
      { weekStart }
    )
    return null
  },
})

/**
 * Hands the email to Resend and marks the week sent in one transaction, so a
 * week is never marked sent without its email queued, or sent twice.
 */
export const deliver = internalMutation({
  args: {
    weekStart: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.string(),
    recordCount: v.number(),
    confirmedThrough: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await getRun(ctx, args.weekStart)
    if (run?.status === "sent") return null

    const emailId = await resend.sendEmail(ctx, {
      from: env.SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS,
      to: parseRecipients(env.SOCIAL_MEDIA_RECORDS_EMAIL_TO),
      subject: args.subject,
      html: args.html,
      text: args.text,
    })
    await saveRun(ctx, run, {
      weekStart: args.weekStart,
      status: "sent",
      failures: run?.failures ?? 0,
      sentAt: Date.now(),
      emailId,
      recordCount: args.recordCount,
      confirmedThrough: args.confirmedThrough,
    })
    return null
  },
})

/**
 * Records of the organisation's competitors that the WCA confirmed after the
 * last email sent before the week starting on `weekStart` and up to `until`, so
 * a record first reported as provisional is reported again once confirmed,
 * whichever week its competition ended in. A week that failed to send leaves
 * its confirmations to the next email that does.
 */
export const confirmedSinceLastEmail = internalQuery({
  args: { weekStart: v.string(), until: v.number() },
  returns: v.array(wcaRecordDocValidator),
  handler: async (ctx, args) => {
    // From the start when no email was sent yet; records never confirmed here
    // have no `confirmedAt`, which sorts before every number.
    let since = 0
    for await (const run of ctx.db
      .query("socialMediaRecordDigestRuns")
      .withIndex("by_weekStart", (q) => q.lt("weekStart", args.weekStart))
      .order("desc")) {
      if (run.status === "sent") {
        since = run.confirmedThrough ?? run.sentAt
        break
      }
    }

    const countryIso2 = competitionCountryIso2()
    const rows = await ctx.db
      .query("wcaRecords")
      .withIndex("by_confirmedAt", (q) =>
        q.gt("confirmedAt", since).lte("confirmedAt", args.until)
      )
      .take(MAX_CONFIRMED_ROWS)
    return rows.filter(
      (row) =>
        row.personCountryIso2 === countryIso2 && row.status === "confirmed"
    )
  },
})

/** Counts a failed attempt; the cron retries until the budget runs out. */
export const recordFailure = internalMutation({
  args: { weekStart: v.string(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await getRun(ctx, args.weekStart)
    if (run?.status === "sent") return null

    await saveRun(ctx, run, {
      weekStart: args.weekStart,
      status: "failed",
      failures: (run?.failures ?? 0) + 1,
      lastError: args.reason,
    })
    return null
  },
})
