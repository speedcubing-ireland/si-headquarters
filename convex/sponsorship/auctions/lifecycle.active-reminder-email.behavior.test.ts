import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../../_generated/dataModel";
import { api, internal } from "../../_generated/api";
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

async function seedScheduledAuction(t: ReturnType<typeof convexTest>): Promise<{
	managerId: Id<"users">;
	competitionId: Id<"competitions">;
	sponsorIds: Id<"sponsors">[];
	auctionId: Id<"sponsorshipAuctions">;
}> {
	return t.run(async (ctx) => {
		const managerId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.DIRECTORS,
			memberIds: [managerId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Test Comp",
			description: "",
			compStart: "2026-09-01",
			compEnd: "2026-09-02",
			organiserIds: [managerId],
			wcaCompetitionId: "TestComp2026",
			updatedAt: Date.now(),
		});
		const sponsorA = await ctx.db.insert("sponsors", {
			name: "Sponsor A",
			email: "a@example.com",
			emailNormalized: "a@example.com",
			active: true,
			createdById: managerId,
			updatedById: managerId,
			updatedAt: Date.now(),
		});
		const sponsorB = await ctx.db.insert("sponsors", {
			name: "Sponsor B",
			email: "b@example.com",
			emailNormalized: "b@example.com",
			active: true,
			createdById: managerId,
			updatedById: managerId,
			updatedAt: Date.now(),
		});
		const now = Date.now();
		const auctionId = await ctx.db.insert("sponsorshipAuctions", {
			competitionId,
			framework: "first_sealed",
			state: "draft",
			currency: "EUR",
			startsAt: now + 86_400_000,
			endsAt: now + 172_800_000,
			antiSnipingWindowMs: 300_000,
			antiSnipingExtendMs: 300_000,
			startPriceCents: 10_000,
			competitionSnapshot: {
				summary: {
					name: "Test Comp",
					address: "",
					startDate: "2026-09-01",
					endDate: "2026-09-02",
					eventIds: [],
				},
				source: "wca",
				fetchedAt: now,
			},
			createdById: managerId,
			updatedById: managerId,
			updatedAt: now,
		});
		for (const sponsorId of [sponsorA, sponsorB]) {
			await ctx.db.insert("sponsorshipAuctionInvites", {
				auctionId,
				sponsorId,
				invitedById: managerId,
				invitedAt: now,
			});
		}
		return {
			managerId,
			competitionId,
			sponsorIds: [sponsorA, sponsorB],
			auctionId,
		};
	});
}

async function getScheduledEmailArgs(
	t: ReturnType<typeof createHarness>,
): Promise<Array<{ emailType: string; recipients: unknown[] }>> {
	return t.run(async (ctx) => {
		const all = await ctx.db.system.query("_scheduled_functions").collect();
		return all
			.filter((fn) => fn.name.includes("enqueueSponsorshipEmailBatch"))
			.map((fn) => {
				const args = (fn.args as unknown[])[0] as {
					emailType: string;
					recipients: unknown[];
				};
				return { emailType: args.emailType, recipients: args.recipients };
			});
	});
}

describe("auction active reminder email behavior", () => {
	test("activation creates pending reminder rows for each invitee", async () => {
		const t = createHarness();
		const { managerId, auctionId, sponsorIds } = await seedScheduledAuction(t);

		await t.run(async (ctx) => {
			await ctx.db.patch("sponsorshipAuctions", auctionId, {
				startsAt: Date.now() - 60_000,
			});
		});

		const manager = t.withIdentity({ subject: managerId });
		await manager.mutation(api.sponsorship.auctions.lifecycle.start, {
			auctionId,
		});

		const reminders = await t.run(async (ctx) => {
			const auction = await ctx.db.get("sponsorshipAuctions", auctionId);
			if (!auction) return [];
			return ctx.db
				.query("sponsorshipAuctionReminders")
				.withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
				.collect();
		});

		expect(reminders).toHaveLength(sponsorIds.length);
		const auction = await t.run((ctx) =>
			ctx.db.get("sponsorshipAuctions", auctionId),
		);
		if (!auction) throw new Error("auction not found");
		const expectedScheduledFor = auction.endsAt - 3_600_000;
		for (const reminder of reminders) {
			expect(reminder.sent).toBe(false);
			expect(reminder.scheduledFor).toBe(expectedScheduledFor);
			expect(reminder.sentAt).toBeUndefined();
		}
	});

	test("cron tick at due time sends email and marks rows sent", async () => {
		const t = createHarness();
		const { auctionId, sponsorIds } = await seedScheduledAuction(t);

		const now = Date.now();
		await t.run(async (ctx) => {
			await ctx.db.patch("sponsorshipAuctions", auctionId, {
				state: "active",
				endsAt: now + 30 * 60_000,
			});
			const auction = await ctx.db.get("sponsorshipAuctions", auctionId);
			if (!auction) throw new Error("auction not found");
			const scheduledFor = auction.endsAt - 3_600_000;
			for (const sponsorId of sponsorIds) {
				await ctx.db.insert("sponsorshipAuctionReminders", {
					auctionId,
					sponsorId,
					scheduledFor,
					sent: false,
				});
			}
		});

		await t.mutation(
			internal.sponsorship.auctions.lifecycle._tickLifecycle,
			{},
		);

		const emails = await getScheduledEmailArgs(t);
		const reminders = emails.filter(
			(e) => e.emailType === "auction_active_reminder",
		);
		expect(reminders).toHaveLength(sponsorIds.length);

		const rows = await t.run((ctx) =>
			ctx.db
				.query("sponsorshipAuctionReminders")
				.withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
				.collect(),
		);
		for (const row of rows) {
			expect(row.sent).toBe(true);
			expect(row.sentAt).toBeDefined();
		}
	});

	test("already-sent rows produce no second email", async () => {
		const t = createHarness();
		const { auctionId, sponsorIds } = await seedScheduledAuction(t);

		const now = Date.now();
		await t.run(async (ctx) => {
			await ctx.db.patch("sponsorshipAuctions", auctionId, {
				state: "active",
				endsAt: now + 30 * 60_000,
			});
			const scheduledFor = now - 3_600_000;
			for (const sponsorId of sponsorIds) {
				await ctx.db.insert("sponsorshipAuctionReminders", {
					auctionId,
					sponsorId,
					scheduledFor,
					sent: true,
					sentAt: now - 100,
				});
			}
		});

		await t.mutation(
			internal.sponsorship.auctions.lifecycle._tickLifecycle,
			{},
		);

		const emails = await getScheduledEmailArgs(t);
		const reminders = emails.filter(
			(e) => e.emailType === "auction_active_reminder",
		);
		expect(reminders).toHaveLength(0);
	});

	test("mixed state: only pending due row fires", async () => {
		const t = createHarness();
		const { auctionId, sponsorIds } = await seedScheduledAuction(t);

		const now = Date.now();
		const [sponsorA, sponsorB] = sponsorIds;
		await t.run(async (ctx) => {
			await ctx.db.patch("sponsorshipAuctions", auctionId, {
				state: "active",
				endsAt: now + 30 * 60_000,
			});
			const scheduledFor = now - 1_000;
			await ctx.db.insert("sponsorshipAuctionReminders", {
				auctionId,
				sponsorId: sponsorA,
				scheduledFor,
				sent: true,
				sentAt: now - 100,
			});
			await ctx.db.insert("sponsorshipAuctionReminders", {
				auctionId,
				sponsorId: sponsorB,
				scheduledFor,
				sent: false,
			});
		});

		await t.mutation(
			internal.sponsorship.auctions.lifecycle._tickLifecycle,
			{},
		);

		const emails = await getScheduledEmailArgs(t);
		const reminderEmails = emails.filter(
			(e) => e.emailType === "auction_active_reminder",
		);
		expect(reminderEmails).toHaveLength(1);

		const rows = await t.run((ctx) =>
			ctx.db
				.query("sponsorshipAuctionReminders")
				.withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
				.collect(),
		);
		const pending = rows.filter((r) => !r.sent);
		expect(pending).toHaveLength(0);
	});

	test("not yet due: no email, rows stay pending", async () => {
		const t = createHarness();
		const { auctionId, sponsorIds } = await seedScheduledAuction(t);

		const now = Date.now();
		await t.run(async (ctx) => {
			await ctx.db.patch("sponsorshipAuctions", auctionId, {
				state: "active",
				endsAt: now + 2 * 60 * 60_000,
			});
			const scheduledFor = now + 60 * 60_000;
			for (const sponsorId of sponsorIds) {
				await ctx.db.insert("sponsorshipAuctionReminders", {
					auctionId,
					sponsorId,
					scheduledFor,
					sent: false,
				});
			}
		});

		await t.mutation(
			internal.sponsorship.auctions.lifecycle._tickLifecycle,
			{},
		);

		const emails = await getScheduledEmailArgs(t);
		const reminders = emails.filter(
			(e) => e.emailType === "auction_active_reminder",
		);
		expect(reminders).toHaveLength(0);

		const rows = await t.run((ctx) =>
			ctx.db
				.query("sponsorshipAuctionReminders")
				.withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
				.collect(),
		);
		for (const row of rows) {
			expect(row.sent).toBe(false);
		}
	});

	test("activation with <1h remaining skips reminder (rows sent=true, no sentAt)", async () => {
		const t = createHarness();
		const { managerId, auctionId, sponsorIds } = await seedScheduledAuction(t);

		await t.run(async (ctx) => {
			const now = Date.now();
			await ctx.db.patch("sponsorshipAuctions", auctionId, {
				startsAt: now - 60_000,
				endsAt: now + 30 * 60_000,
			});
		});

		const manager = t.withIdentity({ subject: managerId });
		await manager.mutation(api.sponsorship.auctions.lifecycle.start, {
			auctionId,
		});

		const rows = await t.run((ctx) =>
			ctx.db
				.query("sponsorshipAuctionReminders")
				.withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
				.collect(),
		);

		expect(rows).toHaveLength(sponsorIds.length);
		for (const row of rows) {
			expect(row.sent).toBe(true);
			expect(row.sentAt).toBeUndefined();
		}

		const emails = await getScheduledEmailArgs(t);
		const reminderEmails = emails.filter(
			(e) => e.emailType === "auction_active_reminder",
		);
		expect(reminderEmails).toHaveLength(0);
	});

	test("auction closed before reminder due: reminder skipped, not sent", async () => {
		const t = createHarness();
		const { auctionId, sponsorIds } = await seedScheduledAuction(t);

		const now = Date.now();
		await t.run(async (ctx) => {
			await ctx.db.patch("sponsorshipAuctions", auctionId, {
				state: "active",
				endsAt: now - 1_000,
			});
			const scheduledFor = now - 1_000;
			for (const sponsorId of sponsorIds) {
				await ctx.db.insert("sponsorshipAuctionReminders", {
					auctionId,
					sponsorId,
					scheduledFor,
					sent: false,
				});
			}
		});

		await t.mutation(
			internal.sponsorship.auctions.lifecycle._tickLifecycle,
			{},
		);

		const emails = await getScheduledEmailArgs(t);
		const reminderEmails = emails.filter(
			(e) => e.emailType === "auction_active_reminder",
		);
		expect(reminderEmails).toHaveLength(0);

		const rows = await t.run((ctx) =>
			ctx.db
				.query("sponsorshipAuctionReminders")
				.withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
				.collect(),
		);
		for (const row of rows) {
			expect(row.sent).toBe(true);
			expect(row.sentAt).toBeUndefined();
		}
	});

	test("personalisation: sponsorHasBid correct per sponsor", async () => {
		const t = createHarness();
		const { auctionId, sponsorIds } = await seedScheduledAuction(t);
		const [sponsorA, sponsorB] = sponsorIds;

		const now = Date.now();
		await t.run(async (ctx) => {
			await ctx.db.patch("sponsorshipAuctions", auctionId, {
				state: "active",
				endsAt: now + 30 * 60_000,
			});
			await ctx.db.insert("sponsorshipBidIntents", {
				auctionId,
				sponsorId: sponsorA,
				mode: "manual",
				amountCents: 50_000,
				isValid: true,
				createdAt: now,
			});
			const scheduledFor = now - 1_000;
			for (const sponsorId of sponsorIds) {
				await ctx.db.insert("sponsorshipAuctionReminders", {
					auctionId,
					sponsorId,
					scheduledFor,
					sent: false,
				});
			}
		});

		await t.mutation(
			internal.sponsorship.auctions.lifecycle._tickLifecycle,
			{},
		);

		const batchArgs = await t.run(async (ctx) => {
			const all = await ctx.db.system.query("_scheduled_functions").collect();
			return all
				.filter((fn) => fn.name.includes("enqueueSponsorshipEmailBatch"))
				.filter((fn) => {
					const args = (fn.args as unknown[])[0] as { emailType: string };
					return args.emailType === "auction_active_reminder";
				})
				.map((fn) => {
					return (fn.args as unknown[])[0] as {
						emailType: string;
						recipients: Array<{ sponsorId: string }>;
						context: { sponsorHasBid: boolean };
					};
				});
		});

		expect(batchArgs).toHaveLength(2);
		const sponsorAArgs = batchArgs.find(
			(b) => b.recipients[0].sponsorId === sponsorA,
		);
		const sponsorBArgs = batchArgs.find(
			(b) => b.recipients[0].sponsorId === sponsorB,
		);
		expect(sponsorAArgs?.context.sponsorHasBid).toBe(true);
		expect(sponsorBArgs?.context.sponsorHasBid).toBe(false);
	});
});
