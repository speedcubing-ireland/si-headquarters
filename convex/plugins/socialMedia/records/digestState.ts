import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { internalMutation, type MutationCtx } from "@/convex/_generated/server"
import { isFeatureEnabled } from "@/config/lib/organisation"
import { isConfiguredLocalTimeInWindow } from "@/convex/notifications/localTime"
import { resend } from "@/convex/sendEmails"
import {
  isLocalMonday,
  previousWeekWindow,
} from "@/convex/plugins/socialMedia/records/window"

/** Local hour on Monday from which the email may go out. */
export const RECORD_DIGEST_SEND_HOUR = 8

/** Attempts per week before the run is left failed for someone to look at. */
export const RECORD_DIGEST_MAX_ATTEMPTS = 5

/**
 * How long a claimed run may go without finishing before the next tick treats
 * its action as lost and claims it again. Each attempt carries its number, so
 * a slow original that finishes after being superseded cannot send as well.
 */
export const RECORD_DIGEST_RUN_LEASE_MS = 30 * 60 * 1000

type DigestRun = Doc<"socialMediaRecordDigestRuns">

function canClaim(run: DigestRun, nowMs: number): boolean {
  if (run.attempts >= RECORD_DIGEST_MAX_ATTEMPTS) return false
  switch (run.status) {
    case "sent":
    case "skipped":
      return false
    case "running":
      return nowMs - run.startedAt >= RECORD_DIGEST_RUN_LEASE_MS
    case "failed":
      return true
  }
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

/** The run, if `attempt` is still the attempt in flight for it. */
async function getCurrentAttempt(
  ctx: MutationCtx,
  weekStart: string,
  attempt: number
): Promise<DigestRun | null> {
  const run = await getRun(ctx, weekStart)
  return run?.status === "running" && run.attempts === attempt ? run : null
}

/**
 * Cron entry point, ticking hourly on Mondays because 08:00 in Dublin is a
 * different UTC hour in summer and winter. Claims the previous week's run once
 * the local send hour is reached and queues the action that builds and sends
 * the email; later ticks that day only act to retry a failed or lost attempt.
 */
export const queueWeeklyDigest = internalMutation({
  args: { nowMs: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!isFeatureEnabled("socialMedia")) return null

    const nowMs = args.nowMs ?? Date.now()
    if (
      !isLocalMonday(nowMs) ||
      !isConfiguredLocalTimeInWindow(RECORD_DIGEST_SEND_HOUR, 24, nowMs)
    ) {
      return null
    }

    const { weekStart } = previousWeekWindow(nowMs)
    const run = await getRun(ctx, weekStart)
    if (run !== null && !canClaim(run, nowMs)) return null

    const attempt = (run?.attempts ?? 0) + 1
    if (run === null) {
      await ctx.db.insert("socialMediaRecordDigestRuns", {
        weekStart,
        status: "running",
        attempts: attempt,
        startedAt: nowMs,
      })
    } else {
      await ctx.db.patch("socialMediaRecordDigestRuns", run._id, {
        status: "running",
        attempts: attempt,
        startedAt: nowMs,
      })
    }

    await ctx.scheduler.runAfter(
      0,
      internal.plugins.socialMedia.records.digest.sendWeeklyRecordsDigest,
      { weekStart, attempt }
    )
    return null
  },
})

/**
 * Hands the email to Resend and marks the run sent in one transaction, so a run
 * is never marked sent without its email queued, or the other way round.
 */
export const deliver = internalMutation({
  args: {
    weekStart: v.string(),
    attempt: v.number(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    html: v.string(),
    text: v.string(),
    recordCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await getCurrentAttempt(ctx, args.weekStart, args.attempt)
    if (run === null) return null

    const emailId = await resend.sendEmail(ctx, {
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    })
    await ctx.db.patch("socialMediaRecordDigestRuns", run._id, {
      status: "sent",
      sentAt: Date.now(),
      emailId,
      recordCount: args.recordCount,
      lastError: undefined,
    })
    return null
  },
})

/** Ends the attempt without sending: `failed` is retried, `skipped` is not. */
export const finishWithoutSending = internalMutation({
  args: {
    weekStart: v.string(),
    attempt: v.number(),
    status: v.union(v.literal("failed"), v.literal("skipped")),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await getCurrentAttempt(ctx, args.weekStart, args.attempt)
    if (run === null) return null

    await ctx.db.patch("socialMediaRecordDigestRuns", run._id, {
      status: args.status,
      lastError: args.reason,
    })
    return null
  },
})
