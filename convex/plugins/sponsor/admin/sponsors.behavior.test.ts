import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";
import { TEAM_NAMES } from "@/convex/permissions/constants"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"

async function seedSponsorshipManager(
	t: ReturnType<typeof convexTest>,
): Promise<Id<"users">> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.DIRECTORS,
			memberIds: [userId],
		});
		return userId;
	});
}

describe("sponsors behavior", () => {
	test("create sponsor stores record with normalized email", async () => {
		const t = convexTest(schema, modules);
		const managerId = await seedSponsorshipManager(t);
		const manager = t.withIdentity({ subject: managerId });

		const sponsorId = await manager.mutation(api.plugins.sponsor.admin.sponsors.create, {
			name: "Acme Corp",
			email: " Sponsor@EXAMPLE.com ",
		});

		const doc = await t.run((ctx) => ctx.db.get("sponsors", sponsorId));
		expect(doc?.name).toBe("Acme Corp");
		expect(doc?.email).toBe("sponsor@example.com");
		expect(doc?.emailNormalized).toBe("sponsor@example.com");
		expect(doc?.active).toBe(true);
	});

	test("create rejects duplicate normalized email", async () => {
		const t = convexTest(schema, modules);
		const managerId = await seedSponsorshipManager(t);
		const manager = t.withIdentity({ subject: managerId });

		await manager.mutation(api.plugins.sponsor.admin.sponsors.create, {
			name: "First",
			email: "dup@example.com",
		});

		await expect(
			manager.mutation(api.plugins.sponsor.admin.sponsors.create, {
				name: "Second",
				email: "DUP@example.com",
			}),
		).rejects.toBeTruthy();
	});

	test("update changes sponsor name and email", async () => {
		const t = convexTest(schema, modules);
		const managerId = await seedSponsorshipManager(t);
		const manager = t.withIdentity({ subject: managerId });

		const sponsorId = await manager.mutation(api.plugins.sponsor.admin.sponsors.create, {
			name: "Old Name",
			email: "old@example.com",
		});

		await manager.mutation(api.plugins.sponsor.admin.sponsors.update, {
			sponsorId,
			name: "New Name",
			email: "new@example.com",
		});

		const doc = await t.run((ctx) => ctx.db.get("sponsors", sponsorId));
		expect(doc?.name).toBe("New Name");
		expect(doc?.email).toBe("new@example.com");
	});

	test("archiving a sponsor invalidates open bids and recomputes the auction leader", async () => {
		const t = convexTest(schema, modules);
		const managerId = await seedSponsorshipManager(t);
		const manager = t.withIdentity({ subject: managerId });
		const now = Date.now();
		const sponsorA = await t.run((ctx) =>
			ctx.db.insert("sponsors", {
				name: "Sponsor A",
				email: "a@example.com",
				emailNormalized: "a@example.com",
				active: true,
				createdById: managerId,
				updatedById: managerId,
				updatedAt: now,
			}),
		);
		const sponsorB = await t.run((ctx) =>
			ctx.db.insert("sponsors", {
				name: "Sponsor B",
				email: "b@example.com",
				emailNormalized: "b@example.com",
				active: true,
				createdById: managerId,
				updatedById: managerId,
				updatedAt: now,
			}),
		);
		const competitionId = await t.run((ctx) =>
			insertTestCompetition(ctx, {
				name: "Archive Test Open",
				from: "2026-09-01",
				to: "2026-09-02",
				organisers: [managerId],
			}),
		)
		const auctionId = await t.run((ctx) =>
			ctx.db.insert("sponsorshipAuctions", {
				competitionId,
				framework: "ebay_proxy",
				state: "active",
				currency: "EUR",
				startsAt: now - 60_000,
				endsAt: now + 60_000,
				antiSnipingWindowMs: 300_000,
				antiSnipingExtendMs: 300_000,
				startPriceCents: 1_000,
				currentPriceCents: 1_700,
				currentLeaderSponsorId: sponsorA,
				currentLeaderMaxCents: 2_000,
				competitionSnapshot: {
					summary: {
						name: "Archive Test Open",
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
		await t.run(async (ctx) => {
			await ctx.db.insert("sponsorshipBidIntents", {
				auctionId,
				sponsorId: sponsorA,
				mode: "proxy",
				amountCents: 1_500,
				maxAmountCents: 2_000,
				isValid: true,
				createdAt: now - 2_000,
			});
			await ctx.db.insert("sponsorshipBidIntents", {
				auctionId,
				sponsorId: sponsorB,
				mode: "manual",
				amountCents: 1_500,
				maxAmountCents: 1_500,
				isValid: true,
				createdAt: now - 1_000,
			});
		});

		await manager.mutation(api.plugins.sponsor.admin.sponsors.update, {
			sponsorId: sponsorA,
			active: false,
		});

		const [auction, sponsorAIntents] = await Promise.all([
			t.run((ctx) => ctx.db.get("sponsorshipAuctions", auctionId)),
			t.run((ctx) =>
				ctx.db
					.query("sponsorshipBidIntents")
					.withIndex("by_auction_and_sponsor", (q) =>
						q.eq("auctionId", auctionId).eq("sponsorId", sponsorA),
					)
					.collect(),
			),
		]);

		expect(sponsorAIntents.every((intent) => !intent.isValid)).toBe(
			true,
		);
		expect(auction?.currentLeaderSponsorId).toBe(sponsorB);
		expect(auction?.currentLeaderMaxCents).toBe(1_500);
		expect(auction?.currentPriceCents).toBe(1_000);
	});
});
