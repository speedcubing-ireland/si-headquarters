import { describe, expect, test } from "vitest";
import { resolveAuctionStartTargetState } from "./sponsorshipLifecycle";

describe("sponsorship lifecycle start transitions", () => {
	test("active auctions are idempotent no-op", () => {
		expect(
			resolveAuctionStartTargetState({
				state: "active",
				startsAt: Date.now() - 5_000,
				now: Date.now(),
			}),
		).toBe("noop");
	});

	test("scheduled auctions before start are idempotent no-op", () => {
		const now = Date.now();
		expect(
			resolveAuctionStartTargetState({
				state: "scheduled",
				startsAt: now + 60_000,
				now,
			}),
		).toBe("noop");
	});

	test("draft auction transitions correctly by start time", () => {
		const now = Date.now();
		expect(
			resolveAuctionStartTargetState({
				state: "draft",
				startsAt: now + 60_000,
				now,
			}),
		).toBe("scheduled");
		expect(
			resolveAuctionStartTargetState({
				state: "draft",
				startsAt: now - 60_000,
				now,
			}),
		).toBe("active");
	});
});
