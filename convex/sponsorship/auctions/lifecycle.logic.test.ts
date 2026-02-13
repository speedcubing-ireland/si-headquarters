import { describe, expect, test } from "vitest";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { closeAuctionInternal } from "./lifecycle";

type IntentDoc = Doc<"sponsorshipBidIntents">;
type AuctionDoc = Doc<"sponsorshipAuctions">;

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

function makeIntent(overrides: Partial<IntentDoc>): IntentDoc {
	const now = Date.now();
	return {
		_id: "intent-seed" as IntentDoc["_id"],
		_creationTime: now,
		auctionId: "auction1" as IntentDoc["auctionId"],
		sponsorId: "s1" as IntentDoc["sponsorId"],
		mode: "manual",
		amountCents: 10_000,
		maxAmountCents: 10_000,
		isValid: true,
		createdAt: now,
		...overrides,
	};
}

function createCtx(input: { auction: AuctionDoc; intents: IntentDoc[] }) {
	const patches: Array<Partial<AuctionDoc>> = [];
	const ctx = {
		db: {
			query: (table: string) => {
				if (table !== "sponsorshipBidIntents") {
					throw new Error(`Unexpected query table: ${table}`);
				}
				return {
					withIndex: () => ({
						collect: async () => input.intents,
					}),
				};
			},
			patch: async (table: string, _id: string, patch: Partial<AuctionDoc>) => {
				if (table !== "sponsorshipAuctions") {
					throw new Error(`Unexpected patch table: ${table}`);
				}
				patches.push(patch);
			},
			get: async (_table: string, _id: string) => null,
		},
	} as unknown as MutationCtx;
	return { ctx, patches };
}

describe("sponsorship auction lifecycle closure", () => {
	test("sealed closure resolves winner from latest valid bid per sponsor", async () => {
		const now = Date.now();
		const auction = makeAuction({ framework: "first_sealed" });
		const intents = [
			makeIntent({
				_id: "intent-a-1" as IntentDoc["_id"],
				sponsorId: "sA" as IntentDoc["sponsorId"],
				amountCents: 25_000,
				maxAmountCents: 25_000,
				createdAt: now - 3_000,
				_creationTime: now - 3_000,
			}),
			makeIntent({
				_id: "intent-b-1" as IntentDoc["_id"],
				sponsorId: "sB" as IntentDoc["sponsorId"],
				amountCents: 20_000,
				maxAmountCents: 20_000,
				createdAt: now - 2_000,
				_creationTime: now - 2_000,
			}),
			makeIntent({
				_id: "intent-a-2" as IntentDoc["_id"],
				sponsorId: "sA" as IntentDoc["sponsorId"],
				amountCents: 15_000,
				maxAmountCents: 15_000,
				createdAt: now - 1_000,
				_creationTime: now - 1_000,
			}),
		];
		const { ctx, patches } = createCtx({ auction, intents });

		await closeAuctionInternal(ctx, auction);

		expect(patches).toHaveLength(1);
		expect(patches[0]).toMatchObject({
			state: "closed",
			winnerSponsorId: "sB",
			winningBidId: "intent-b-1",
			settlementAmountCents: 20_000,
		});
	});

	test("sealed closure tie goes to earlier latest bid", async () => {
		const now = Date.now();
		const auction = makeAuction({ framework: "first_sealed" });
		const intents = [
			makeIntent({
				_id: "intent-a-1" as IntentDoc["_id"],
				sponsorId: "sA" as IntentDoc["sponsorId"],
				amountCents: 20_000,
				maxAmountCents: 20_000,
				createdAt: now - 2_000,
				_creationTime: now - 2_000,
			}),
			makeIntent({
				_id: "intent-b-1" as IntentDoc["_id"],
				sponsorId: "sB" as IntentDoc["sponsorId"],
				amountCents: 20_000,
				maxAmountCents: 20_000,
				createdAt: now - 1_000,
				_creationTime: now - 1_000,
			}),
		];
		const { ctx, patches } = createCtx({ auction, intents });

		await closeAuctionInternal(ctx, auction);

		expect(patches).toHaveLength(1);
		expect(patches[0]).toMatchObject({
			state: "closed",
			winnerSponsorId: "sA",
			winningBidId: "intent-a-1",
			settlementAmountCents: 20_000,
		});
	});
});
