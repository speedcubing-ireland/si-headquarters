import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { TEAM_NAMES } from "../../lib/constants";
import { listMembersForTeams } from "../../lib/permissions/teams";
import type { SponsorshipEmailContext } from "../../lib/sponsorshipEmailTemplates";
import type { SponsorshipAuctionFramework } from "../../lib/sponsorshipValidators";
import { enqueueSponsorshipEmailBatch } from "../emailQueue";

type AuctionEmailType =
	| "auction_scheduled"
	| "auction_started"
	| "auction_closed_winner"
	| "auction_closed_outbid"
	| "auction_closed_none"
	| "internal_invoice";

function sponsorAuctionUrl(auctionId: Id<"sponsorshipAuctions">): string {
	const siteUrl = process.env.SITE_URL ?? "https://hq.speedcubing.ie";
	return `${siteUrl}/sponsor/auctions/${auctionId}`;
}

function sponsorshipAdminUrl(): string {
	const siteUrl = process.env.SITE_URL ?? "https://hq.speedcubing.ie";
	return `${siteUrl}/admin/sponsorship`;
}

async function resolveAuctionEmailRecipients(
	ctx: MutationCtx,
	auction: Doc<"sponsorshipAuctions">,
): Promise<{
	competition: Doc<"competitions">;
	sponsors: Doc<"sponsors">[];
} | null> {
	const [competition, invites] = await Promise.all([
		ctx.db.get("competitions", auction.competitionId),
		ctx.db
			.query("sponsorshipAuctionInvites")
			.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
			.collect(),
	]);
	if (!competition) return null;
	const allSponsors = await Promise.all(
		invites.map((invite) => ctx.db.get("sponsors", invite.sponsorId)),
	);
	const sponsors = allSponsors.filter((sponsor): sponsor is Doc<"sponsors"> =>
		Boolean(sponsor),
	);
	return { competition, sponsors };
}

function toRecipientList(
	sponsors: Doc<"sponsors">[],
): { sponsorId: Id<"sponsors">; email: string; name: string }[] {
	return sponsors.map((sponsor) => ({
		sponsorId: sponsor._id,
		email: sponsor.email,
		name: sponsor.name,
	}));
}

async function queueAuctionEmails(
	ctx: MutationCtx,
	input: {
		auction: Doc<"sponsorshipAuctions">;
		type: AuctionEmailType;
		recipients: { sponsorId?: Id<"sponsors">; email: string; name?: string }[];
		subject: string;
		message: string;
		context?: SponsorshipEmailContext;
	},
): Promise<void> {
	if (input.recipients.length === 0) return;
	await enqueueSponsorshipEmailBatch(ctx, {
		batchKey: `auction:${input.auction._id}:${input.type}:${input.auction.updatedAt}`,
		auctionId: input.auction._id,
		emailType: input.type,
		subject: input.subject,
		message: input.message,
		recipients: input.recipients,
		context: input.context,
	});
}

export function describeAuctionFramework(
	framework: SponsorshipAuctionFramework,
): string {
	switch (framework) {
		case "first_sealed":
			return "This is a sealed-bid auction. All bids are hidden. The highest bidder wins and pays their bid amount.";
		case "vickrey":
			return "This is a sealed-bid auction. All bids are hidden. The highest bidder wins but pays the second-highest bid amount.";
		case "ebay_proxy":
			return "This is a proxy-bid auction. You set a maximum bid and the system bids on your behalf up to that amount.";
	}
}

export async function sendAuctionScheduledEmails(
	ctx: MutationCtx,
	auction: Doc<"sponsorshipAuctions">,
): Promise<void> {
	const resolved = await resolveAuctionEmailRecipients(ctx, auction);
	if (!resolved) return;
	const { competition, sponsors } = resolved;
	await queueAuctionEmails(ctx, {
		auction,
		type: "auction_scheduled",
		recipients: toRecipientList(sponsors),
		subject: `${competition.name}: bidding opening soon`,
		message:
			"A sponsorship auction has been scheduled. You will be notified when bidding opens.",
		context: {
			competitionName: competition.name,
			portalUrl: sponsorAuctionUrl(auction._id),
			startsAt: auction.startsAt,
			endsAt: auction.endsAt,
			frameworkDescription: describeAuctionFramework(auction.framework),
			startPriceCents: auction.startPriceCents,
			currency: auction.currency,
		},
	});
}

export async function sendAuctionStartedEmails(
	ctx: MutationCtx,
	auction: Doc<"sponsorshipAuctions">,
): Promise<void> {
	const resolved = await resolveAuctionEmailRecipients(ctx, auction);
	if (!resolved) return;
	const { competition, sponsors } = resolved;
	await queueAuctionEmails(ctx, {
		auction,
		type: "auction_started",
		recipients: toRecipientList(sponsors),
		subject: `${competition.name}: sponsorship bidding is live`,
		message:
			"Sponsorship bidding is now live in the HQ sponsor portal. Please submit your bid before closing time.",
		context: {
			competitionName: competition.name,
			portalUrl: sponsorAuctionUrl(auction._id),
			startsAt: auction.startsAt,
			endsAt: auction.endsAt,
		},
	});
}

export async function sendAuctionClosureEmails(
	ctx: MutationCtx,
	auction: Doc<"sponsorshipAuctions">,
): Promise<void> {
	const resolved = await resolveAuctionEmailRecipients(ctx, auction);
	if (!resolved) return;
	const { competition, sponsors: recipients } = resolved;

	if (auction.winnerSponsorId && auction.settlementAmountCents !== undefined) {
		const winner = recipients.find(
			(sponsor) => sponsor._id === auction.winnerSponsorId,
		);
		if (winner) {
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
				subject: `${competition.name}: you are the confirmed sponsor`,
				message: `You won the sponsorship auction at EUR ${(auction.settlementAmountCents / 100).toFixed(2)}. Finance will follow up with invoice details.`,
				context: {
					competitionName: competition.name,
					portalUrl: sponsorAuctionUrl(auction._id),
					settlementAmountCents: auction.settlementAmountCents,
					winnerSponsorName: winner.name,
				},
			});
		}
		const outbidRecipients = toRecipientList(
			recipients.filter((sponsor) => sponsor._id !== auction.winnerSponsorId),
		);
		await queueAuctionEmails(ctx, {
			auction,
			type: "auction_closed_outbid",
			recipients: outbidRecipients,
			subject: `${competition.name}: sponsorship auction closed`,
			message:
				"This sponsorship auction has now closed. Thank you for participating.",
			context: {
				competitionName: competition.name,
				portalUrl: sponsorAuctionUrl(auction._id),
			},
		});
	} else {
		await queueAuctionEmails(ctx, {
			auction,
			type: "auction_closed_none",
			recipients: toRecipientList(recipients),
			subject: `${competition.name}: sponsorship auction closed`,
			message: "This sponsorship auction closed without a winning bid.",
			context: {
				competitionName: competition.name,
				portalUrl: sponsorAuctionUrl(auction._id),
			},
		});
	}

	const managerIds = await listMembersForTeams(ctx, [
		TEAM_NAMES.DIRECTORS,
		TEAM_NAMES.FINANCE,
	]);
	const managerUsers = await Promise.all(
		[...managerIds].map((userId) => ctx.db.get("users", userId)),
	);
	const internalRecipients = managerUsers.flatMap((user) =>
		user?.email ? [{ email: user.email, name: user.name ?? undefined }] : [],
	);
	const winnerSponsor = auction.winnerSponsorId
		? recipients.find((sponsor) => sponsor._id === auction.winnerSponsorId)
		: null;
	await queueAuctionEmails(ctx, {
		auction,
		type: "internal_invoice",
		recipients: internalRecipients,
		subject: `${competition.name}: sponsorship invoice follow-up required`,
		message: winnerSponsor
			? `Winner confirmed: ${winnerSponsor.name} at EUR ${((auction.settlementAmountCents ?? 0) / 100).toFixed(2)}. Send invoice follow-up.`
			: "No winning sponsor. Mark competition sponsorship status as None or relaunch.",
		context: {
			competitionName: competition.name,
			adminUrl: sponsorshipAdminUrl(),
			settlementAmountCents: auction.settlementAmountCents,
			winnerSponsorName: winnerSponsor?.name,
		},
	});
}
