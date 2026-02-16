import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { TEAM_NAMES } from "../../lib/constants";
import { listMembersForTeams } from "../../lib/permissions/teams";
import { enqueueSponsorshipEmailBatch } from "../emailQueue";

type AuctionEmailType =
	| "auction_started"
	| "auction_winner"
	| "auction_outbid"
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

async function queueAuctionEmails(
	ctx: MutationCtx,
	input: {
		auction: Doc<"sponsorshipAuctions">;
		type: AuctionEmailType;
		recipients: { sponsorId?: Id<"sponsors">; email: string; name?: string }[];
		subject: string;
		message: string;
		context?: {
			competitionName?: string;
			portalUrl?: string;
			adminUrl?: string;
			settlementAmountCents?: number;
			winnerSponsorName?: string;
			startsAt?: number;
			endsAt?: number;
		};
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

export async function sendAuctionStartedEmails(
	ctx: MutationCtx,
	auction: Doc<"sponsorshipAuctions">,
): Promise<void> {
	const [competition, invites] = await Promise.all([
		ctx.db.get("competitions", auction.competitionId),
		ctx.db
			.query("sponsorshipAuctionInvites")
			.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
			.collect(),
	]);
	if (!competition) return;
	const sponsors = await Promise.all(
		invites.map((invite) => ctx.db.get("sponsors", invite.sponsorId)),
	);
	const recipients = sponsors
		.filter((sponsor): sponsor is Doc<"sponsors"> => Boolean(sponsor))
		.map((sponsor) => ({
			sponsorId: sponsor._id,
			email: sponsor.email,
			name: sponsor.name,
		}));
	await queueAuctionEmails(ctx, {
		auction,
		type: "auction_started",
		recipients,
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
	const [competition, invites] = await Promise.all([
		ctx.db.get("competitions", auction.competitionId),
		ctx.db
			.query("sponsorshipAuctionInvites")
			.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
			.collect(),
	]);
	if (!competition) return;
	const sponsors = await Promise.all(
		invites.map((invite) => ctx.db.get("sponsors", invite.sponsorId)),
	);
	const recipients = sponsors.filter((sponsor): sponsor is Doc<"sponsors"> =>
		Boolean(sponsor),
	);

	if (auction.winnerSponsorId && auction.settlementAmountCents !== undefined) {
		const winner = recipients.find(
			(sponsor) => sponsor._id === auction.winnerSponsorId,
		);
		if (winner) {
			await queueAuctionEmails(ctx, {
				auction,
				type: "auction_winner",
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
		const outbidRecipients = recipients
			.filter((sponsor) => sponsor._id !== auction.winnerSponsorId)
			.map((sponsor) => ({
				sponsorId: sponsor._id,
				email: sponsor.email,
				name: sponsor.name,
			}));
		await queueAuctionEmails(ctx, {
			auction,
			type: "auction_outbid",
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
			recipients: recipients.map((sponsor) => ({
				sponsorId: sponsor._id,
				email: sponsor.email,
				name: sponsor.name,
			})),
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
