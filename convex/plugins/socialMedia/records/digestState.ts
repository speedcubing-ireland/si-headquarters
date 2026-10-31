import type { WithoutSystemFields } from "convex/server"
import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "@/convex/_generated/server"
import { isFeatureEnabled } from "@/config/lib/organisation"
import { isConfiguredLocalTimeInWindow } from "@/convex/notifications/localTime"
import { resend } from "@/convex/sendEmails"
import { requireRecordsEmailSettings } from "@/convex/settings/model"
import {
  confirmedBetween,
  recordsForWeek,
} from "@/convex/plugins/socialMedia/records/store"
import { weekToReport } from "@/convex/plugins/socialMedia/records/window"
import { wcaRecordDocValidator } from "@/convex/plugins/socialMedia/validators"

/** Local hour on Monday from which the email may go out. */
export const RECORD_DIGEST_SEND_HOUR = 8

/** Failed attempts per week before the run is left for someone to look at. */
export const RECORD_DIGEST_MAX_ATTEMPTS = 5

type DigestRun = Doc<"socialMediaRecordDigestRuns">

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
 * week is never marked sent without its email queued, or sent twice. Throws
 * while Admin → Settings has no recipients, which the action records as the
 * run's failure.
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

    const { recipients, senderAddress } = await requireRecordsEmailSettings(ctx)
    const emailId = await resend.sendEmail(ctx, {
      from: senderAddress,
      to: recipients,
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
 * What the email for the week starting on `weekStart` lists. Confirmed holds
 * the week's confirmed records and those the WCA confirmed after the last email
 * sent before that week and up to `until`, so a record first reported as
 * provisional is reported again once confirmed, whichever week its competition
 * ended in. A week that failed to send leaves its confirmations to the next
 * email that does. Provisional holds the week's records still as WCA Live
 * entered them.
 */
export const recordsForEmail = internalQuery({
  args: { weekStart: v.string(), until: v.number() },
  returns: v.object({
    confirmed: v.array(wcaRecordDocValidator),
    provisional: v.array(wcaRecordDocValidator),
  }),
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

    const week = await recordsForWeek(ctx, args.weekStart)
    const weekConfirmed = week.filter((row) => row.status === "confirmed")
    const weekIds = new Set(weekConfirmed.map((row) => row._id))
    const earlier = (await confirmedBetween(ctx, since, args.until)).filter(
      (row) => !weekIds.has(row._id)
    )
    return {
      confirmed: [...weekConfirmed, ...earlier],
      provisional: week.filter((row) => row.status === "live"),
    }
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
