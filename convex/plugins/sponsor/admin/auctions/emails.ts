import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { listMembersForTeams } from "@/convex/teams/model"
import {
  describeAuctionFramework,
  getSponsorshipEmailPayload,
} from "@/convex/plugins/sponsor/emails/copy"
import type {
  SponsorshipAuctionEmailType,
  SponsorshipEmailContext,
} from "@/convex/plugins/sponsor/lib/validators"
import { isProxyAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import {
  sponsorPortalAuctionUrl,
  sponsorshipAdminPageUrl,
} from "@/convex/plugins/sponsor/siteUrls"
import { scheduleSponsorshipEmailBatch } from "../../emails/send"

export { describeAuctionFramework }

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

function toRecipientList(
  sponsors: Doc<"sponsors">[]
): { sponsorId: Id<"sponsors">; email: string; name: string }[] {
  return sponsors.map((sponsor) => ({
    sponsorId: sponsor._id,
    email: sponsor.email,
    name: sponsor.name,
  }))
}

async function queueAuctionEmails(
  ctx: MutationCtx,
  input: {
    auction: Doc<"sponsorshipAuctions">
    type: SponsorshipAuctionEmailType
    recipients: { sponsorId?: Id<"sponsors">; email: string; name?: string }[]
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
    frameworkDescription: describeAuctionFramework(auction.framework),
    startPriceCents: auction.startPriceCents,
    currency: auction.currency,
  }
  await queueAuctionEmails(ctx, {
    auction,
    type: "auction_scheduled",
    recipients: toRecipientList(sponsors),
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
    recipients: toRecipientList(sponsors),
    context,
  })
}

export async function sendAuctionActiveReminderEmail(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">,
  sponsor: Doc<"sponsors">
): Promise<void> {
  const competition = await ctx.db.get("competitions", auction.competitionId)
  if (!competition) return
  const intents = await ctx.db
    .query("sponsorshipBidIntents")
    .withIndex("by_auction_and_sponsor", (q) =>
      q.eq("auctionId", auction._id).eq("sponsorId", sponsor._id)
    )
    .collect()
  const sponsorHasBid = intents.some((i) => i.isValid)
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
    recipients: [
      { sponsorId: sponsor._id, email: sponsor.email, name: sponsor.name },
    ],
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

  await ctx.db.insert("sponsorshipAuctionOutbidNotices", {
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
  await scheduleSponsorshipEmailBatch(ctx, {
    auctionId: auction._id,
    emailType: "auction_ebay_outbid",
    subject,
    message,
    recipients: [
      { sponsorId: outbidSponsorId, email: sponsor.email, name: sponsor.name },
    ],
    context,
  })
}

export async function sendAuctionClosureEmails(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<void> {
  const resolved = await resolveAuctionEmailRecipients(ctx, auction)
  if (!resolved) return
  const { competition, sponsors: recipients } = resolved

  if (auction.winnerSponsorId && auction.settlementAmountCents !== undefined) {
    const winner = recipients.find(
      (sponsor) => sponsor._id === auction.winnerSponsorId
    )
    if (winner) {
      const winnerContext: SponsorshipEmailContext = {
        competitionName: competition.name,
        portalUrl: sponsorAuctionUrl(auction._id),
        settlementAmountCents: auction.settlementAmountCents,
        winnerSponsorName: winner.name,
      }
      await queueAuctionEmails(ctx, {
        auction,
        type: "auction_closed_winner",
        recipients: [
          {
            sponsorId: winner._id,
            email: winner.email,
            name: winner.name,
          },
        ],
        context: winnerContext,
      })
    }
    const outbidRecipients = toRecipientList(
      recipients.filter((sponsor) => sponsor._id !== auction.winnerSponsorId)
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
      recipients: toRecipientList(recipients),
      context: {
        competitionName: competition.name,
        portalUrl: sponsorAuctionUrl(auction._id),
      },
    })
  }

  const managerIds = await listMembersForTeams(ctx, [
    TEAM_NAMES.DIRECTORS,
    TEAM_NAMES.FINANCE,
  ])
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
  const winnerSponsor = auction.winnerSponsorId
    ? recipients.find((sponsor) => sponsor._id === auction.winnerSponsorId)
    : null
  const internalContext: SponsorshipEmailContext = {
    competitionName: competition.name,
    adminUrl: sponsorshipAdminUrl(),
    settlementAmountCents: auction.settlementAmountCents,
    winnerSponsorName: winnerSponsor?.name,
  }
  await queueAuctionEmails(ctx, {
    auction,
    type: "internal_invoice",
    recipients: internalRecipients,
    context: internalContext,
  })
}
