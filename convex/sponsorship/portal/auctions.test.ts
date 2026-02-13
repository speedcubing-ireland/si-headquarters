import { describe, expect, test } from "vitest";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { placeBidHandler, setMaxBidHandler } from "./auctions";

type AuctionDoc = Doc<"sponsorshipAuctions">;
type IntentDoc = Doc<"sponsorshipBidIntents">;

function makeAuction(overrides: Partial<AuctionDoc> = {}): AuctionDoc {
	const now = Date.now();
	return {
		_id: "auction1" as AuctionDoc["_id"],
		_creationTime: now,
		competitionId: "comp1" as AuctionDoc["competitionId"],
		framework: "first_sealed",
		state: "active",
		currency: "EUR",
		startsAt: now - 60_000,
		endsAt: now + 60_000,
		antiSnipingWindowMs: 5 * 60_000,
		antiSnipingExtendMs: 5 * 60_000,
		startPriceCents: 10_000,
		currentPriceCents: undefined,
		currentLeaderSponsorId: undefined,
		currentLeaderMaxCents: undefined,
		winnerSponsorId: undefined,
		winningBidId: undefined,
		settlementAmountCents: undefined,
		readinessSnapshotJson: undefined,
		createdById: "u1" as AuctionDoc["createdById"],
		updatedById: "u1" as AuctionDoc["updatedById"],
		updatedAt: now,
		...overrides,
	};
}

function makePortalCtx(input: { auction: AuctionDoc; intents?: IntentDoc[] }) {
	const intents = [...(input.intents ?? [])];
	const patches: Array<Partial<AuctionDoc>> = [];
	const now = Date.now();
	const sponsorId = "sponsor1";
	const authUserId = "auth-user-1";

	const ctx = {
		runQuery: async (_ref: unknown, args: Record<string, unknown>) => {
			if (args.model === "session") {
				return {
					_id: "session-1",
					token: "session-token",
					userId: authUserId,
					expiresAt: now + 60_000,
					createdAt: now - 10_000,
					updatedAt: now - 10_000,
				};
			}
			if (args.model === "user") {
				return {
					_id: authUserId,
					email: "sponsor@example.com",
					name: "Sponsor",
					emailVerified: true,
					createdAt: now - 10_000,
					updatedAt: now - 10_000,
				};
			}
			throw new Error(`Unexpected model: ${String(args.model)}`);
		},
		db: {
			query: (table: string) => {
				if (table === "sponsors") {
					return {
						withIndex: () => ({
							unique: async () => ({
								_id: sponsorId,
								name: "Sponsor",
								email: "sponsor@example.com",
								emailNormalized: "sponsor@example.com",
								avatarUrl: undefined,
								authUserId,
								lastAccessEmailSentAt: undefined,
								active: true,
								createdById: "u1",
								updatedById: "u1",
								updatedAt: now,
							}),
						}),
					};
				}
				if (table === "sponsorshipAuctionInvites") {
					return {
						withIndex: () => ({
							unique: async () => ({
								_id: "invite-1",
								auctionId: input.auction._id,
								sponsorId,
								invitedById: "u1",
								invitedAt: now,
								inviteSentAt: undefined,
								_creationTime: now,
							}),
						}),
					};
				}
				if (table === "sponsorshipBidIntents") {
					return {
						withIndex: () => ({
							collect: async () => intents,
						}),
					};
				}
				throw new Error(`Unexpected query table: ${table}`);
			},
			get: async (table: string, id: string) => {
				if (table === "sponsorshipAuctions" && id === input.auction._id) {
					return input.auction;
				}
				return null;
			},
			insert: async (table: string, value: Record<string, unknown>) => {
				if (table !== "sponsorshipBidIntents") {
					throw new Error(`Unexpected insert table: ${table}`);
				}
				const intent: IntentDoc = {
					_id: `intent-${intents.length + 1}` as IntentDoc["_id"],
					_creationTime: now,
					auctionId: input.auction._id,
					sponsorId: value.sponsorId as IntentDoc["sponsorId"],
					mode: value.mode as IntentDoc["mode"],
					amountCents: value.amountCents as number,
					maxAmountCents: value.maxAmountCents as number | undefined,
					isValid: true,
					createdAt: value.createdAt as number,
				};
				intents.push(intent);
				return intent._id;
			},
			patch: async (table: string, _id: string, patch: Partial<AuctionDoc>) => {
				if (table !== "sponsorshipAuctions") {
					throw new Error(`Unexpected patch table: ${table}`);
				}
				patches.push(patch);
			},
		},
	} as unknown as MutationCtx;

	return { ctx, patches, sponsorId };
}

describe("sponsor portal auction mutations", () => {
	test("setMaxBid rejects sealed auctions", async () => {
		const auction = makeAuction({ framework: "first_sealed" });
		const { ctx } = makePortalCtx({
			auction,
		});

		await expect(
			setMaxBidHandler(ctx, {
				sessionToken: "session-token",
				auctionId: auction._id,
				maxAmountCents: 20_000,
			}),
		).rejects.toMatchObject({
			data: {
				code: "BAD_REQUEST",
				message: "Max bids are only available for eBay proxy auctions.",
			},
		});
	});

	test("placeBid accepts sealed auction bids", async () => {
		const auction = makeAuction({ framework: "first_sealed" });
		const { ctx, patches, sponsorId } = makePortalCtx({
			auction,
		});

		const result = await placeBidHandler(ctx, {
			sessionToken: "session-token",
			auctionId: auction._id,
			amountCents: 10_000,
		});

		expect(result).toEqual({ currentPriceCents: 10_000 });
		expect(patches[patches.length - 1]).toMatchObject({
			currentPriceCents: 10_000,
			currentLeaderSponsorId: sponsorId,
			currentLeaderMaxCents: 10_000,
		});
	});

	test("placeBid allows lowering existing sealed bid because latest bid is used", async () => {
		const now = Date.now();
		const auction = makeAuction({
			framework: "first_sealed",
			currentPriceCents: 20_000,
			currentLeaderSponsorId:
				"sponsor1" as AuctionDoc["currentLeaderSponsorId"],
			currentLeaderMaxCents: 20_000,
		});
		const { ctx, patches, sponsorId } = makePortalCtx({
			auction,
			intents: [
				{
					_id: "intent-old" as IntentDoc["_id"],
					_creationTime: now - 1_000,
					auctionId: auction._id,
					sponsorId: "sponsor1" as IntentDoc["sponsorId"],
					mode: "manual",
					amountCents: 20_000,
					maxAmountCents: 20_000,
					isValid: true,
					createdAt: now - 1_000,
				},
			],
		});

		const result = await placeBidHandler(ctx, {
			sessionToken: "session-token",
			auctionId: auction._id,
			amountCents: 15_000,
		});

		expect(result).toEqual({ currentPriceCents: 15_000 });
		expect(patches[patches.length - 1]).toMatchObject({
			currentPriceCents: 15_000,
			currentLeaderSponsorId: sponsorId,
			currentLeaderMaxCents: 15_000,
		});
	});
});
