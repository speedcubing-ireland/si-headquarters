import { describe, expect, test } from "vitest";
import {
	incrementForEbayDeEur,
	minNextBidCents,
	resolveProxyState,
	resolveSealedOutcome,
} from "./bidding";

describe("sponsorship bidding engine", () => {
	test("increment table boundaries follow EUR brackets", () => {
		expect(incrementForEbayDeEur(100)).toBe(20);
		expect(incrementForEbayDeEur(499)).toBe(20);
		expect(incrementForEbayDeEur(500)).toBe(50);
		expect(incrementForEbayDeEur(2499)).toBe(50);
		expect(incrementForEbayDeEur(2500)).toBe(100);
		expect(incrementForEbayDeEur(9999)).toBe(100);
		expect(incrementForEbayDeEur(24999)).toBe(250);
		expect(incrementForEbayDeEur(25000)).toBe(500);
		expect(incrementForEbayDeEur(49999)).toBe(500);
		expect(incrementForEbayDeEur(50000)).toBe(1000);
		expect(incrementForEbayDeEur(99999)).toBe(1000);
		expect(incrementForEbayDeEur(100000)).toBe(2000);
		expect(incrementForEbayDeEur(249999)).toBe(2000);
		expect(incrementForEbayDeEur(250000)).toBe(5000);
		expect(incrementForEbayDeEur(499999)).toBe(5000);
		expect(incrementForEbayDeEur(10000)).toBe(250);
		expect(incrementForEbayDeEur(500000)).toBe(10000);
	});

	test("min next bid falls back to start price when no visible price exists", () => {
		expect(minNextBidCents(null, 1500)).toBe(1500);
		expect(minNextBidCents(500, 1500)).toBe(550);
	});

	test("proxy winner is highest max and tie keeps earlier firstMaxSetAt", () => {
		const tied = resolveProxyState(
			[
				{ sponsorId: "A", maxAmountCents: 3000, firstMaxSetAt: 1000 },
				{ sponsorId: "B", maxAmountCents: 3000, firstMaxSetAt: 1001 },
			],
			1000,
		);
		expect(tied?.leaderSponsorId).toBe("A");
	});

	test("proxy tie fallback is deterministic when first-max timestamps match", () => {
		const tied = resolveProxyState(
			[
				{ sponsorId: "Z", maxAmountCents: 3000, firstMaxSetAt: 1000 },
				{ sponsorId: "A", maxAmountCents: 3000, firstMaxSetAt: 1000 },
			],
			1000,
		);
		expect(tied?.leaderSponsorId).toBe("A");
	});

	test("proxy visible price uses min(leader max, runner-up + increment)", () => {
		const result = resolveProxyState(
			[
				{ sponsorId: "A", maxAmountCents: 5000, firstMaxSetAt: 1000 },
				{ sponsorId: "B", maxAmountCents: 3000, firstMaxSetAt: 1001 },
			],
			1000,
		);
		expect(result).toEqual({
			currentPriceCents: 3100,
			leaderSponsorId: "A",
			leaderMaxCents: 5000,
			runnerUpMaxCents: 3000,
		});
	});

	test("proxy with no runner-up keeps start price visible", () => {
		const result = resolveProxyState(
			[{ sponsorId: "A", maxAmountCents: 7000, firstMaxSetAt: 1000 }],
			2000,
		);
		expect(result?.currentPriceCents).toBe(2000);
		expect(result?.leaderSponsorId).toBe("A");
	});

	test("sealed outcome uses each sponsor latest bid", () => {
		const result = resolveSealedOutcome([
			{
				intentId: "a-1",
				sponsorId: "A",
				amountCents: 15_000,
				createdAt: 1,
				createdOrder: 1,
			},
			{
				intentId: "b-1",
				sponsorId: "B",
				amountCents: 16_000,
				createdAt: 2,
				createdOrder: 2,
			},
			{
				intentId: "a-2",
				sponsorId: "A",
				amountCents: 17_000,
				createdAt: 3,
				createdOrder: 3,
			},
		]);
		expect(result).toEqual({
			leaderSponsorId: "A",
			leaderIntentId: "a-2",
			leaderBidCents: 17_000,
			settlementBidCents: 17_000,
		});
	});

	test("sealed outcome breaks ties by earlier latest bid timestamp", () => {
		const result = resolveSealedOutcome([
			{
				intentId: "a-1",
				sponsorId: "A",
				amountCents: 20_000,
				createdAt: 1,
				createdOrder: 1,
			},
			{
				intentId: "b-1",
				sponsorId: "B",
				amountCents: 20_000,
				createdAt: 2,
				createdOrder: 2,
			},
		]);
		expect(result?.leaderSponsorId).toBe("A");
		expect(result?.leaderIntentId).toBe("a-1");
		expect(result?.settlementBidCents).toBe(20_000);
	});

	test("sealed second-price outcome charges second-highest bid with reserve floor", () => {
		const result = resolveSealedOutcome(
			[
				{
					intentId: "a-1",
					sponsorId: "A",
					amountCents: 21_000,
					createdAt: 1,
					createdOrder: 1,
				},
				{
					intentId: "b-1",
					sponsorId: "B",
					amountCents: 15_000,
					createdAt: 2,
					createdOrder: 2,
				},
			],
			{
				pricing: "second_price",
				reservePriceCents: 10_000,
			},
		);
		expect(result?.leaderSponsorId).toBe("A");
		expect(result?.leaderBidCents).toBe(21_000);
		expect(result?.settlementBidCents).toBe(15_000);
	});

	test("sealed second-price uses reserve when there is no runner-up bid", () => {
		const result = resolveSealedOutcome(
			[
				{
					intentId: "a-1",
					sponsorId: "A",
					amountCents: 21_000,
					createdAt: 1,
					createdOrder: 1,
				},
			],
			{
				pricing: "second_price",
				reservePriceCents: 10_000,
			},
		);
		expect(result?.settlementBidCents).toBe(10_000);
	});
});
