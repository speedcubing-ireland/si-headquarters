import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../../_generated/dataModel";
import { api } from "../../_generated/api";
import schema from "../../schema";
import cronsSchema from "../../../node_modules/@convex-dev/crons/src/component/schema";
import { modules } from "../../test.setup";
import { TEAM_NAMES } from "../../lib/constants";

const cronsModules = import.meta.glob<string[]>(
	"../../../node_modules/@convex-dev/crons/src/component/**/!(*.*.*)*.*s",
);

function createHarness() {
	const t = convexTest(schema, modules);
	t.registerComponent("crons", cronsSchema, cronsModules);
	return t;
}

async function seedAuctionPrereqs(t: ReturnType<typeof convexTest>): Promise<{
	managerId: Id<"users">;
	competitionId: Id<"competitions">;
	sponsorId: Id<"sponsors">;
}> {
	return t.run(async (ctx) => {
		const managerId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.DIRECTORS,
			memberIds: [managerId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Auction Comp",
			description: "",
			compStart: "2026-09-01",
			compEnd: "2026-09-02",
			organiserIds: [managerId],
			updatedAt: Date.now(),
		});
		const sponsorId = await ctx.db.insert("sponsors", {
			name: "Sponsor A",
			email: "sponsor-a@example.com",
			emailNormalized: "sponsor-a@example.com",
			active: true,
			createdById: managerId,
			updatedById: managerId,
			updatedAt: Date.now(),
		});
		return { managerId, competitionId, sponsorId };
	});
}

describe("auction management behavior", () => {
	test("create auction stores record in draft state with competition snapshot", async () => {
		const t = createHarness();
		const { managerId, competitionId, sponsorId } = await seedAuctionPrereqs(t);
		const manager = t.withIdentity({ subject: managerId });

		const now = Date.now();
		const auctionId = await manager.mutation(
			api.sponsorship.auctions.management.create,
			{
				competitionId,
				startsAt: now + 86_400_000,
				endsAt: now + 172_800_000,
				startPriceCents: 5000,
				invitedSponsorIds: [sponsorId],
			},
		);

		const doc = await t.run((ctx) =>
			ctx.db.get("sponsorshipAuctions", auctionId),
		);
		expect(doc?.state).toBe("draft");
		expect(doc?.framework).toBe("first_sealed");
		expect(doc?.currency).toBe("EUR");
		expect(doc?.startPriceCents).toBe(5000);
		expect(doc?.competitionSnapshot).toBeTruthy();
		expect(doc?.competitionId).toBe(competitionId);
	});

	test("update changes framework and dates in draft state", async () => {
		const t = createHarness();
		const { managerId, competitionId, sponsorId } = await seedAuctionPrereqs(t);
		const manager = t.withIdentity({ subject: managerId });

		const now = Date.now();
		const auctionId = await manager.mutation(
			api.sponsorship.auctions.management.create,
			{
				competitionId,
				startsAt: now + 86_400_000,
				endsAt: now + 172_800_000,
				startPriceCents: 5000,
				invitedSponsorIds: [sponsorId],
			},
		);

		const newStart = now + 200_000_000;
		const newEnd = now + 300_000_000;
		await manager.mutation(api.sponsorship.auctions.management.update, {
			auctionId,
			framework: "vickrey",
			startsAt: newStart,
			endsAt: newEnd,
		});

		const doc = await t.run((ctx) =>
			ctx.db.get("sponsorshipAuctions", auctionId),
		);
		expect(doc?.framework).toBe("vickrey");
		expect(doc?.startsAt).toBe(newStart);
		expect(doc?.endsAt).toBe(newEnd);
	});

	test("removeBeforeOpen deletes draft auction", async () => {
		const t = createHarness();
		const { managerId, competitionId, sponsorId } = await seedAuctionPrereqs(t);
		const manager = t.withIdentity({ subject: managerId });

		const now = Date.now();
		const auctionId = await manager.mutation(
			api.sponsorship.auctions.management.create,
			{
				competitionId,
				startsAt: now + 86_400_000,
				endsAt: now + 172_800_000,
				startPriceCents: 5000,
				invitedSponsorIds: [sponsorId],
			},
		);

		await manager.mutation(
			api.sponsorship.auctions.management.removeBeforeOpen,
			{ auctionId },
		);

		const doc = await t.run((ctx) =>
			ctx.db.get("sponsorshipAuctions", auctionId),
		);
		expect(doc).toBeNull();
	});

	test("removeBeforeOpen rejects active auctions", async () => {
		const t = createHarness();
		const { managerId, competitionId } = await seedAuctionPrereqs(t);
		const manager = t.withIdentity({ subject: managerId });

		const now = Date.now();
		const auctionId = await t.run(async (ctx) =>
			ctx.db.insert("sponsorshipAuctions", {
				competitionId,
				framework: "first_sealed",
				state: "active",
				currency: "EUR",
				startsAt: now - 86_400_000,
				endsAt: now + 86_400_000,
				antiSnipingWindowMs: 300_000,
				antiSnipingExtendMs: 300_000,
				startPriceCents: 5000,
				competitionSnapshot: {
					summary: {
						name: "Auction Comp",
						address: "",
						startDate: "2026-09-01",
						endDate: "2026-09-02",
						eventIds: [],
					},
					source: "competition_record",
					fetchedAt: now,
				},
				createdById: managerId,
				updatedById: managerId,
				updatedAt: now,
			}),
		);

		await expect(
			manager.mutation(api.sponsorship.auctions.management.removeBeforeOpen, {
				auctionId,
			}),
		).rejects.toBeTruthy();
	});

	test("create rejects non-positive anti-sniping settings", async () => {
		const t = createHarness();
		const { managerId, competitionId, sponsorId } = await seedAuctionPrereqs(t);
		const manager = t.withIdentity({ subject: managerId });
		const now = Date.now();

		await expect(
			manager.mutation(api.sponsorship.auctions.management.create, {
				competitionId,
				startsAt: now + 86_400_000,
				endsAt: now + 172_800_000,
				startPriceCents: 5000,
				invitedSponsorIds: [sponsorId],
				antiSnipingWindowMs: 0,
			}),
		).rejects.toBeTruthy();
		await expect(
			manager.mutation(api.sponsorship.auctions.management.create, {
				competitionId,
				startsAt: now + 86_400_000,
				endsAt: now + 172_800_000,
				startPriceCents: 5000,
				invitedSponsorIds: [sponsorId],
				antiSnipingExtendMs: -1,
			}),
		).rejects.toBeTruthy();
	});
});
