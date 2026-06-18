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
  sponsorPortalAuctionUrl,
  sponsorPortalGuideUrl,
  sponsorshipAdminPageUrl,
} from "@/convex/plugins/sponsor/siteUrls"
import { buildAuctionEmailRecipient } from "../../lib/contacts"
import { scheduleSponsorshipEmailBatch } from "../../emails/send"

function sponsorAuctionUrl(auctionId: Id<"sponsorshipAuctions">): string {
  return sponsorPortalAuctionUrl(String(auctionId))
}

function sponsorshipAdminUrl(): string {
  return sponsorshipAdminPageUrl()
}

async function resolveAuctionEmailRecipients(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<{
  competition: Doc<"competitions">
  sponsors: Doc<"sponsors">[]
} | null> {
  const [competition, invites] = await Promise.all([
    ctx.db.get("competitions", auction.competitionId),
    ctx.db
      .query("sponsorshipAuctionInvites")
      .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
      .collect(),
  ])
  if (!competition) return null
  const allSponsors = await Promise.all(
    invites.map((invite) => ctx.db.get("sponsors", invite.sponsorId))
  )
  const sponsors = allSponsors.filter((sponsor): sponsor is Doc<"sponsors"> =>
    Boolean(sponsor?.active)
  )
  return { competition, sponsors }
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
  if (!resolved) return
  const { competition, sponsors } = resolved
  const context: SponsorshipEmailContext = {
    competitionName: competition.name,
    portalUrl: sponsorAuctionUrl(auction._id),
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
  if (!resolved) return
  const { competition, sponsors } = resolved
  const context: SponsorshipEmailContext = {
    competitionName: competition.name,
    portalUrl: sponsorAuctionUrl(auction._id),
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
  const competition = await ctx.db.get("competitions", auction.competitionId)
  if (!competition) return
  const context: SponsorshipEmailContext = {
    competitionName: competition.name,
    portalUrl: sponsorAuctionUrl(auction._id),
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

  const [sponsor, competition] = await Promise.all([
    ctx.db.get("sponsors", outbidSponsorId),
    ctx.db.get("competitions", auction.competitionId),
  ])
  if (sponsor?.active !== true) return
  if (competition === null) return

  const noticeId = await ctx.db.insert("sponsorshipAuctionOutbidNotices", {
    auctionId: auction._id,
    sponsorId: outbidSponsorId,
    sentAt: now,
  })

  const context: SponsorshipEmailContext = {
    competitionName: competition.name,
    portalUrl: sponsorAuctionUrl(auction._id),
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

type ClosedAuctionEmailOutcome =
  | { kind: "no_winner" }
  | {
      kind: "winner"
      winnerSponsorId: Id<"sponsors">
      winningBidId: Id<"sponsorshipBidIntents">
      settlementAmountCents: number
    }

function resolveClosedAuctionEmailOutcome(
  auction: Doc<"sponsorshipAuctions">
): ClosedAuctionEmailOutcome {
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
  if (!resolved) return
  const { competition, sponsors: recipients } = resolved

  if (outcome.kind === "winner") {
    const winner = recipients.find(
      (sponsor) => sponsor._id === outcome.winnerSponsorId
    )
    if (winner) {
      const winnerContext: SponsorshipEmailContext = {
        competitionName: competition.name,
        portalUrl: sponsorAuctionUrl(auction._id),
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
        competitionName: competition.name,
        portalUrl: sponsorAuctionUrl(auction._id),
      },
    })
  } else {
    await queueAuctionEmails(ctx, {
      auction,
      type: "auction_closed_none",
      recipients: await toRecipientList(ctx, recipients),
      context: {
        competitionName: competition.name,
        portalUrl: sponsorAuctionUrl(auction._id),
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
    competitionName: competition.name,
    adminUrl: sponsorshipAdminUrl(),
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
