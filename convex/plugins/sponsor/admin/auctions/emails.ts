import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { listMembersForTeams } from "@/convex/teams/model"
import { getSponsorshipEmailPayload } from "@/convex/plugins/sponsor/emails/copy"
import type {
  SponsorshipAuctionEmailType,
  SponsorshipEmailContext,
} from "@/convex/plugins/sponsor/lib/validators"
import { isProxyAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import {
  auctionSubjectName,
  resolveAuctionSubject,
} from "@/convex/plugins/sponsor/lib/auctionSubject"
import {
  sponsorPortalAuctionUrl,
  sponsorPortalGuideUrl,
  sponsorshipAdminPageUrl,
} from "@/convex/plugins/sponsor/siteUrls"
import type { AuctionOutcome } from "../../lib/auctionState"
import { buildAuctionEmailRecipient } from "../../lib/contacts"
import { scheduleSponsorshipEmailBatch } from "../../emails/send"

async function resolveAuctionEmailSubjectName(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<string | null> {
  const subject = resolveAuctionSubject(auction)
  if (subject.kind !== "hq_competition") {
    return auctionSubjectName(auction)
  }
  const competition = await ctx.db.get("competitions", subject.competitionId)
  return competition?.name ?? null
}

async function resolveAuctionEmailRecipients(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<{
  subjectName: string
  sponsors: Doc<"sponsors">[]
} | null> {
  const [subjectName, invites] = await Promise.all([
    resolveAuctionEmailSubjectName(ctx, auction),
    ctx.db
      .query("sponsorshipAuctionInvites")
      .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
      .collect(),
  ])
  if (subjectName === null) return null
  const allSponsors = await Promise.all(
    invites.map((invite) => ctx.db.get("sponsors", invite.sponsorId))
  )
  const sponsors = allSponsors.filter((sponsor): sponsor is Doc<"sponsors"> =>
    Boolean(sponsor?.active)
  )
  return { subjectName, sponsors }
}

async function toRecipientList(
  ctx: MutationCtx,
  sponsors: Doc<"sponsors">[]
): Promise<
  {
    sponsorId: Id<"sponsors">
    email: string
    name: string
    cc?: string[]
  }[]
> {
  return await Promise.all(
    sponsors.map((sponsor) => buildAuctionEmailRecipient(ctx, sponsor))
  )
}

async function queueAuctionEmails(
  ctx: MutationCtx,
  input: {
    auction: Doc<"sponsorshipAuctions">
    type: SponsorshipAuctionEmailType
    recipients: {
      sponsorId?: Id<"sponsors">
      email: string
      name?: string
      cc?: string[]
      dedupKey?: string
    }[]
    context: SponsorshipEmailContext
  }
): Promise<void> {
  if (input.recipients.length === 0) return
  const { subject, message } = getSponsorshipEmailPayload(
    input.type,
    input.context
  )
  await scheduleSponsorshipEmailBatch(ctx, {
    auctionId: input.auction._id,
    emailType: input.type,
    subject,
    message,
    recipients: input.recipients,
    context: input.context,
  })
}

export async function sendAuctionScheduledEmails(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<void> {
  const resolved = await resolveAuctionEmailRecipients(ctx, auction)
  if (resolved === null) return
  const { subjectName, sponsors } = resolved
  const context: SponsorshipEmailContext = {
    competitionName: subjectName,
    portalUrl: sponsorPortalAuctionUrl(String(auction._id)),
    startsAt: auction.startsAt,
    endsAt: auction.endsAt,
    framework: auction.framework,
    frameworkGuideUrl: sponsorPortalGuideUrl(),
    startPriceCents: auction.startPriceCents,
    currency: auction.currency,
  }
  await queueAuctionEmails(ctx, {
    auction,
    type: "auction_scheduled",
    recipients: await toRecipientList(ctx, sponsors),
    context,
  })
}

export async function sendAuctionStartedEmails(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<void> {
  const resolved = await resolveAuctionEmailRecipients(ctx, auction)
  if (resolved === null) return
  const { subjectName, sponsors } = resolved
  const context: SponsorshipEmailContext = {
    competitionName: subjectName,
    portalUrl: sponsorPortalAuctionUrl(String(auction._id)),
    startsAt: auction.startsAt,
    endsAt: auction.endsAt,
  }
  await queueAuctionEmails(ctx, {
    auction,
    type: "auction_started",
    recipients: await toRecipientList(ctx, sponsors),
    context,
  })
}

export async function sendAuctionActiveReminderEmail(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">,
  sponsor: Doc<"sponsors">,
  sponsorHasBid: boolean
): Promise<void> {
  const subjectName = await resolveAuctionEmailSubjectName(ctx, auction)
  if (subjectName === null) return
  const context: SponsorshipEmailContext = {
    competitionName: subjectName,
    portalUrl: sponsorPortalAuctionUrl(String(auction._id)),
    endsAt: auction.endsAt,
    sponsorHasBid,
  }
  const { subject, message } = getSponsorshipEmailPayload(
    "auction_active_reminder",
    context
  )
  await scheduleSponsorshipEmailBatch(ctx, {
    auctionId: auction._id,
    emailType: "auction_active_reminder",
    subject,
    message,
    recipients: [await buildAuctionEmailRecipient(ctx, sponsor)],
    context,
  })
}

export async function sendEbayAuctionOutbidEmail(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">,
  outbidSponsorId: Id<"sponsors">
): Promise<void> {
  if (!isProxyAuctionFramework(auction.framework)) return

  const now = Date.now()
  const throttleWindowMs = 10 * 60 * 1000
  const latestNotice = await ctx.db
    .query("sponsorshipAuctionOutbidNotices")
    .withIndex("by_auction_and_sponsor", (q) =>
      q.eq("auctionId", auction._id).eq("sponsorId", outbidSponsorId)
    )
    .order("desc")
    .first()
  if (latestNotice && latestNotice.sentAt > now - throttleWindowMs) return

  const [subjectName, sponsor] = await Promise.all([
    resolveAuctionEmailSubjectName(ctx, auction),
    ctx.db.get("sponsors", outbidSponsorId),
  ])
  if (subjectName === null) return
  if (sponsor?.active !== true) return

  const noticeId = await ctx.db.insert("sponsorshipAuctionOutbidNotices", {
    auctionId: auction._id,
    sponsorId: outbidSponsorId,
    sentAt: now,
  })

  const context: SponsorshipEmailContext = {
    competitionName: subjectName,
    portalUrl: sponsorPortalAuctionUrl(String(auction._id)),
    endsAt: auction.endsAt,
  }
  const { subject, message } = getSponsorshipEmailPayload(
    "auction_ebay_outbid",
    context
  )
  const recipient = await buildAuctionEmailRecipient(ctx, sponsor)
  await scheduleSponsorshipEmailBatch(ctx, {
    auctionId: auction._id,
    emailType: "auction_ebay_outbid",
    subject,
    message,
    recipients: [{ ...recipient, dedupKey: `auction_ebay_outbid:${noticeId}` }],
    context,
  })
}

function resolveClosedAuctionEmailOutcome(
  auction: Doc<"sponsorshipAuctions">
): AuctionOutcome {
  const { settlementAmountCents, winnerSponsorId, winningBidId } = auction
  const hasWinner = winnerSponsorId !== undefined
  const hasWinningBid = winningBidId !== undefined
  const hasSettlement = settlementAmountCents !== undefined
  const hasAnyOutcomeField = hasWinner || hasWinningBid || hasSettlement

  if (!hasAnyOutcomeField) {
    return { kind: "no_winner" }
  }
  if (!hasWinner || !hasWinningBid || !hasSettlement) {
    throw new ConvexError({
      code: "INTERNAL_ERROR",
      message:
        "Closed auction outcome is incomplete: winner, winning bid, and settlement amount must be recorded together.",
    })
  }

  return {
    kind: "winner",
    winnerSponsorId,
    winningBidId,
    settlementAmountCents,
  }
}

export async function sendAuctionClosureEmails(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<void> {
  const outcome = resolveClosedAuctionEmailOutcome(auction)
  const resolved = await resolveAuctionEmailRecipients(ctx, auction)
  if (resolved === null) return
  const { subjectName, sponsors: recipients } = resolved

  if (outcome.kind === "winner") {
    const winner = recipients.find(
      (sponsor) => sponsor._id === outcome.winnerSponsorId
    )
    if (winner) {
      const winnerContext: SponsorshipEmailContext = {
        competitionName: subjectName,
        portalUrl: sponsorPortalAuctionUrl(String(auction._id)),
        settlementAmountCents: outcome.settlementAmountCents,
        winnerSponsorName: winner.name,
      }
      await queueAuctionEmails(ctx, {
        auction,
        type: "auction_closed_winner",
        recipients: [await buildAuctionEmailRecipient(ctx, winner)],
        context: winnerContext,
      })
    }
    const outbidRecipients = await toRecipientList(
      ctx,
      recipients.filter((sponsor) => sponsor._id !== outcome.winnerSponsorId)
    )
    await queueAuctionEmails(ctx, {
      auction,
      type: "auction_closed_outbid",
      recipients: outbidRecipients,
      context: {
        competitionName: subjectName,
        portalUrl: sponsorPortalAuctionUrl(String(auction._id)),
      },
    })
  } else {
    await queueAuctionEmails(ctx, {
      auction,
      type: "auction_closed_none",
      recipients: await toRecipientList(ctx, recipients),
      context: {
        competitionName: subjectName,
        portalUrl: sponsorPortalAuctionUrl(String(auction._id)),
      },
    })
  }

  const managerIds = await listMembersForTeams(ctx, [TEAM_NAMES.FINANCE])
  const managerUsers = await Promise.all(
    [...managerIds].map((userId) => ctx.db.get("users", userId))
  )
  const internalRecipients = managerUsers.flatMap((user) => {
    const email = user?.email
    if (email === undefined || email.length === 0) {
      return []
    }
    return [{ email, name: user?.name ?? undefined }]
  })
  const winnerSponsor =
    outcome.kind === "winner"
      ? await ctx.db.get("sponsors", outcome.winnerSponsorId)
      : null
  const internalContext: SponsorshipEmailContext = {
    competitionName: subjectName,
    adminUrl: sponsorshipAdminPageUrl(),
    settlementAmountCents:
      outcome.kind === "winner" ? outcome.settlementAmountCents : undefined,
    winnerSponsorName: winnerSponsor?.name,
  }
  await queueAuctionEmails(ctx, {
    auction,
    type: "internal_invoice",
    recipients: internalRecipients,
    context: internalContext,
  })
}
