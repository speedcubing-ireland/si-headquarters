import { ConvexError, v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { internalMutation } from "@/convex/_generated/server"
import { resend } from "@/convex/sendEmails"
import { getSponsorshipSenderAddress } from "@/convex/plugins/sponsor/emails/sender"
import { normalizeEmail } from "@/convex/plugins/sponsor/sanitize"
import {
  sponsorshipEmailContext,
  sponsorshipEmailType,
  type ScheduleSponsorshipEmailBatchArgs,
} from "@/convex/plugins/sponsor/lib/validators"
import { deriveDispatchDedupKey } from "./dedup"

export type {
  ScheduleSponsorshipEmailBatchArgs,
  SponsorshipEmailRecipient,
} from "@/convex/plugins/sponsor/lib/validators"

export const SPONSORSHIP_EMAIL_DISPATCH_PROCESSING_LEASE_MS = 10 * 60 * 1000
export const SPONSORSHIP_EMAIL_DISPATCH_MAX_ATTEMPTS = 5

const retryDelaysMs = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const

function nextRetryDelayMs(attempts: number): number {
  return retryDelaysMs[Math.min(attempts - 1, retryDelaysMs.length - 1)]
}

export async function scheduleSponsorshipEmailBatch(
  ctx: MutationCtx,
  args: ScheduleSponsorshipEmailBatchArgs
): Promise<void> {
  if (args.recipients.length === 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "No recipients specified for sponsorship email batch.",
    })
  }

  const dispatchIds: Id<"sponsorshipEmailDispatches">[] = []
  const now = Date.now()
  const enqueueNonce = `${String(now)}:${Math.random().toString(36).slice(2)}`

  for (const recipient of args.recipients) {
    const recipientEmail = normalizeEmail(recipient.email)
    if (recipientEmail.length === 0) continue

    const dedupKey = deriveDispatchDedupKey({
      emailType: args.emailType,
      auctionId: args.auctionId,
      sponsorId: recipient.sponsorId,
      email: recipientEmail,
      enqueueNonce,
      explicit: recipient.dedupKey,
    })

    const existing = await ctx.db
      .query("sponsorshipEmailDispatches")
      .withIndex("by_dedup_key", (q) => q.eq("dedupKey", dedupKey))
      .first()
    if (existing) {
      if (existing.status === "pending") dispatchIds.push(existing._id)
      continue
    }

    const cc =
      recipient.cc
        ?.map((address) => normalizeEmail(address))
        .filter(
          (address) => address.length > 0 && address !== recipientEmail
        ) ?? []

    const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
      dedupKey,
      emailType: args.emailType,
      recipientEmail,
      recipientName: recipient.name,
      ...(cc.length > 0 ? { cc } : {}),
      subject: args.subject,
      message: args.message,
      ...(args.context ? { context: args.context } : {}),
      ...(args.auctionId ? { auctionId: args.auctionId } : {}),
      ...(recipient.sponsorId ? { sponsorId: recipient.sponsorId } : {}),
      status: "pending",
      attempts: 0,
      createdAt: now,
      nextAttemptAt: now,
    })
    dispatchIds.push(dispatchId)
  }

  if (dispatchIds.length === 0) return

  await ctx.scheduler.runAfter(
    0,
    internal.plugins.sponsor.emails.sendBatch.processSponsorshipEmailDispatches,
    { dispatchIds }
  )
}

export async function repairEmailDispatches(ctx: MutationCtx): Promise<void> {
  const now = Date.now()
  const staleBefore = now - 5 * 60 * 1000
  const duePending = await ctx.db
    .query("sponsorshipEmailDispatches")
    .withIndex("by_status_and_next_attempt", (q) =>
      q.eq("status", "pending").gt("nextAttemptAt", 0).lte("nextAttemptAt", now)
    )
    .take(100)
  const legacyStalePending = (
    await ctx.db
      .query("sponsorshipEmailDispatches")
      .withIndex("by_status_and_created", (q) =>
        q.eq("status", "pending").lt("createdAt", staleBefore)
      )
      .take(100)
  ).filter((dispatch) => dispatch.nextAttemptAt === undefined)
  const staleProcessing = await ctx.db
    .query("sponsorshipEmailDispatches")
    .withIndex("by_status_and_processing_started", (q) =>
      q
        .eq("status", "processing")
        .lt(
          "processingStartedAt",
          now - SPONSORSHIP_EMAIL_DISPATCH_PROCESSING_LEASE_MS
        )
    )
    .take(100)

  const dispatchIds = new Set<Id<"sponsorshipEmailDispatches">>()
  for (const dispatch of [...duePending, ...legacyStalePending]) {
    dispatchIds.add(dispatch._id)
  }
  for (const dispatch of staleProcessing) {
    const attempts = dispatch.attempts + 1
    if (attempts >= SPONSORSHIP_EMAIL_DISPATCH_MAX_ATTEMPTS) {
      await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
        status: "failed",
        attempts,
        lastAttemptAt: now,
        processingStartedAt: undefined,
        nextAttemptAt: undefined,
        lastError: "Processing lease expired before delivery completed.",
        failedAt: now,
      })
      continue
    }

    await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
      status: "pending",
      attempts,
      lastAttemptAt: now,
      processingStartedAt: undefined,
      nextAttemptAt: now,
      lastError: "Processing lease expired before delivery completed.",
      failedAt: undefined,
    })
    dispatchIds.add(dispatch._id)
  }

  if (dispatchIds.size > 0) {
    await ctx.scheduler.runAfter(
      0,
      internal.plugins.sponsor.emails.sendBatch
        .processSponsorshipEmailDispatches,
      { dispatchIds: [...dispatchIds] }
    )
  }
}

export const claimSponsorshipEmailDispatchForRender = internalMutation({
  args: { dispatchId: v.id("sponsorshipEmailDispatches") },
  returns: v.union(
    v.null(),
    v.object({
      emailType: sponsorshipEmailType,
      recipientName: v.optional(v.string()),
      message: v.string(),
      context: v.optional(sponsorshipEmailContext),
    })
  ),
  handler: async (ctx, args) => {
    const dispatch = await ctx.db.get(
      "sponsorshipEmailDispatches",
      args.dispatchId
    )
    if (dispatch?.status !== "pending") return null
    const now = Date.now()
    if (dispatch.nextAttemptAt !== undefined && dispatch.nextAttemptAt > now) {
      return null
    }

    if (dispatch.recipientEmail.length === 0) {
      await ctx.db.patch("sponsorshipEmailDispatches", args.dispatchId, {
        status: "skipped",
        attempts: dispatch.attempts + 1,
        lastAttemptAt: now,
        nextAttemptAt: undefined,
        processingStartedAt: undefined,
      })
      return null
    }

    await ctx.db.patch("sponsorshipEmailDispatches", args.dispatchId, {
      status: "processing",
      processingStartedAt: now,
      lastAttemptAt: now,
      lastError: undefined,
      failedAt: undefined,
    })

    return {
      emailType: dispatch.emailType,
      recipientName: dispatch.recipientName,
      message: dispatch.message,
      context: dispatch.context,
    }
  },
})

export const deliverSponsorshipEmailDispatch = internalMutation({
  args: {
    dispatchId: v.id("sponsorshipEmailDispatches"),
    html: v.optional(v.string()),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const dispatch = await ctx.db.get(
      "sponsorshipEmailDispatches",
      args.dispatchId
    )
    if (dispatch?.status !== "processing") return null

    const cc = (dispatch.cc ?? []).filter(
      (address) => address.length > 0 && address !== dispatch.recipientEmail
    )
    const emailId = await resend.sendEmail(ctx, {
      from: getSponsorshipSenderAddress(),
      to: dispatch.recipientEmail,
      ...(cc.length > 0 ? { cc } : {}),
      subject: dispatch.subject,
      html: args.html,
      text: args.text,
    })

    const now = Date.now()
    await ctx.db.patch("sponsorshipEmailDispatches", args.dispatchId, {
      status: "sent",
      emailId,
      sentAt: now,
      attempts: dispatch.attempts + 1,
      lastAttemptAt: now,
      nextAttemptAt: undefined,
      processingStartedAt: undefined,
      lastError: undefined,
      failedAt: undefined,
    })
    return null
  },
})

export const recordSponsorshipEmailDispatchFailure = internalMutation({
  args: {
    dispatchId: v.id("sponsorshipEmailDispatches"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const dispatch = await ctx.db.get(
      "sponsorshipEmailDispatches",
      args.dispatchId
    )
    if (
      !dispatch ||
      dispatch.status === "sent" ||
      dispatch.status === "skipped" ||
      dispatch.status === "failed"
    ) {
      return null
    }

    const now = Date.now()
    const attempts = dispatch.attempts + 1
    if (attempts >= SPONSORSHIP_EMAIL_DISPATCH_MAX_ATTEMPTS) {
      await ctx.db.patch("sponsorshipEmailDispatches", args.dispatchId, {
        status: "failed",
        attempts,
        lastAttemptAt: now,
        processingStartedAt: undefined,
        nextAttemptAt: undefined,
        lastError: args.error,
        failedAt: now,
      })
      return null
    }

    const nextAttemptAt = now + nextRetryDelayMs(attempts)
    await ctx.db.patch("sponsorshipEmailDispatches", args.dispatchId, {
      status: "pending",
      attempts,
      lastAttemptAt: now,
      processingStartedAt: undefined,
      nextAttemptAt,
      lastError: args.error,
      failedAt: undefined,
    })
    await ctx.scheduler.runAt(
      nextAttemptAt,
      internal.plugins.sponsor.emails.sendBatch
        .processSponsorshipEmailDispatches,
      { dispatchIds: [args.dispatchId] }
    )
    return null
  },
})

export const deliverSponsorshipEmail = internalMutation({
  args: {
    from: v.string(),
    to: v.string(),
    cc: v.optional(v.array(v.string())),
    subject: v.string(),
    html: v.optional(v.string()),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await resend.sendEmail(ctx, {
      from: args.from,
      to: args.to,
      ...(args.cc && args.cc.length > 0 ? { cc: args.cc } : {}),
      subject: args.subject,
      html: args.html,
      text: args.text,
    })
  },
})
