import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("sponsorship email dispatch lifecycle behavior", () => {
	test("_processDispatch assigns sending claim and provider operation id", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const now = Date.now();
			const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
				auctionId: undefined,
				sponsorId: undefined,
				emailType: "invite",
				recipient: "sponsor@example.com",
				recipientName: "Sponsor",
				subject: "Invite",
				message: "Welcome",
				contextJson: undefined,
				idempotencyKey: "dispatch:seeded:process",
				status: "pending",
				attempts: 0,
				maxAttempts: 5,
				scheduledFor: now - 1,
				scheduledFunctionId: undefined,
				claimKey: undefined,
				lastAttemptAt: undefined,
				providerOperationId: undefined,
				providerPollerState: undefined,
				sentAt: undefined,
				providerMessageId: undefined,
				error: undefined,
				createdAt: now,
				updatedAt: now,
			});
			return { dispatchId };
		});

		await t.mutation(internal.sponsorshipEmails._processDispatch, {
			dispatchId: seeded.dispatchId,
		});

		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		expect(dispatch?.status).toBe("sending");
		expect(dispatch?.attempts).toBe(1);
		expect(typeof dispatch?.claimKey).toBe("string");
		expect(dispatch?.providerOperationId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(dispatch?.providerPollerState).toBeUndefined();
	});

	test("_markDispatchSent finalizes a recovered pending dispatch for the same attempt", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const now = Date.now();
			const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
				auctionId: undefined,
				sponsorId: undefined,
				emailType: "invite",
				recipient: "sponsor@example.com",
				recipientName: "Sponsor",
				subject: "Invite",
				message: "Welcome",
				contextJson: undefined,
				idempotencyKey: "dispatch:seeded:1",
				status: "pending",
				attempts: 1,
				maxAttempts: 5,
				scheduledFor: now + 60_000,
				scheduledFunctionId: undefined,
				claimKey: undefined,
				lastAttemptAt: now - 30_000,
				sentAt: undefined,
				providerMessageId: undefined,
				error: "dispatch_send_timeout",
				createdAt: now - 30_000,
				updatedAt: now - 30_000,
			});
			const scheduledFunctionId = await ctx.scheduler.runAfter(
				60_000,
				internal.sponsorshipEmails._processDispatch,
				{ dispatchId },
			);
			await ctx.db.patch("sponsorshipEmailDispatches", dispatchId, {
				scheduledFunctionId,
				updatedAt: now,
			});

			return {
				dispatchId,
				claimKey: `${dispatchId}:1:${now - 30_000}`,
			};
		});

		await t.mutation(internal.sponsorshipEmails._markDispatchSent, {
			dispatchId: seeded.dispatchId,
			claimKey: seeded.claimKey,
			providerMessageId: "provider-msg-1",
		});

		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		expect(dispatch?.status).toBe("sent");
		expect(dispatch?.claimKey).toBeUndefined();
		expect(dispatch?.scheduledFor).toBeUndefined();
		expect(dispatch?.scheduledFunctionId).toBeUndefined();
		expect(dispatch?.providerMessageId).toBe("provider-msg-1");
		expect(typeof dispatch?.sentAt).toBe("number");
		expect(dispatch?.error).toBeUndefined();
	});

	test("_markDispatchSent ignores stale claims from older attempts", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const now = Date.now();
			const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
				auctionId: undefined,
				sponsorId: undefined,
				emailType: "invite",
				recipient: "sponsor@example.com",
				recipientName: "Sponsor",
				subject: "Invite",
				message: "Welcome",
				contextJson: undefined,
				idempotencyKey: "dispatch:seeded:2",
				status: "sending",
				attempts: 2,
				maxAttempts: 5,
				scheduledFor: undefined,
				scheduledFunctionId: undefined,
				claimKey: undefined,
				lastAttemptAt: now,
				sentAt: undefined,
				providerMessageId: undefined,
				error: undefined,
				createdAt: now - 60_000,
				updatedAt: now,
			});
			await ctx.db.patch("sponsorshipEmailDispatches", dispatchId, {
				claimKey: `${dispatchId}:2:${now}`,
			});

			return {
				dispatchId,
				staleClaimKey: `${dispatchId}:1:${now - 60_000}`,
			};
		});

		await t.mutation(internal.sponsorshipEmails._markDispatchSent, {
			dispatchId: seeded.dispatchId,
			claimKey: seeded.staleClaimKey,
			providerMessageId: "provider-msg-stale",
		});

		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		expect(dispatch?.status).toBe("sending");
		expect(dispatch?.providerMessageId).toBeUndefined();
		expect(dispatch?.sentAt).toBeUndefined();
	});

	test("_markDispatchInProgress refreshes lastAttemptAt heartbeat", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const now = Date.now();
			const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
				auctionId: undefined,
				sponsorId: undefined,
				emailType: "invite",
				recipient: "sponsor@example.com",
				recipientName: "Sponsor",
				subject: "Invite",
				message: "Welcome",
				contextJson: undefined,
				idempotencyKey: "dispatch:seeded:in-progress",
				status: "sending",
				attempts: 1,
				maxAttempts: 5,
				scheduledFor: undefined,
				scheduledFunctionId: undefined,
				claimKey: `${String(now)}:1:${now}`,
				lastAttemptAt: now - 60_000,
				providerOperationId: "old-op",
				providerPollerState: "old-state",
				sentAt: undefined,
				providerMessageId: undefined,
				error: undefined,
				createdAt: now - 60_000,
				updatedAt: now - 60_000,
			});
			const dispatch = await ctx.db.get(
				"sponsorshipEmailDispatches",
				dispatchId,
			);
			return {
				dispatchId,
				claimKey: dispatch?.claimKey ?? "",
				previousAttemptAt: dispatch?.lastAttemptAt ?? 0,
			};
		});

		await t.mutation(internal.sponsorshipEmails._markDispatchInProgress, {
			dispatchId: seeded.dispatchId,
			claimKey: seeded.claimKey,
			providerOperationId: "new-op",
			providerPollerState: "new-state",
		});

		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		expect(dispatch?.providerOperationId).toBe("new-op");
		expect(dispatch?.providerPollerState).toBe("new-state");
		expect((dispatch?.lastAttemptAt ?? 0) > seeded.previousAttemptAt).toBe(
			true,
		);
	});

	test("_markDispatchTransientError keeps sending claim active", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const now = Date.now();
			const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
				auctionId: undefined,
				sponsorId: undefined,
				emailType: "invite",
				recipient: "sponsor@example.com",
				recipientName: "Sponsor",
				subject: "Invite",
				message: "Welcome",
				contextJson: undefined,
				idempotencyKey: "dispatch:seeded:transient",
				status: "sending",
				attempts: 1,
				maxAttempts: 5,
				scheduledFor: undefined,
				scheduledFunctionId: undefined,
				claimKey: `${String(now)}:1:${now}`,
				lastAttemptAt: now - 30_000,
				providerOperationId: "existing-op",
				providerPollerState: "existing-state",
				sentAt: undefined,
				providerMessageId: undefined,
				error: undefined,
				createdAt: now - 60_000,
				updatedAt: now - 60_000,
			});
			const dispatch = await ctx.db.get(
				"sponsorshipEmailDispatches",
				dispatchId,
			);
			return {
				dispatchId,
				claimKey: dispatch?.claimKey ?? "",
			};
		});

		await t.mutation(internal.sponsorshipEmails._markDispatchTransientError, {
			dispatchId: seeded.dispatchId,
			claimKey: seeded.claimKey,
			error: "gateway timeout",
		});

		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		expect(dispatch?.status).toBe("sending");
		expect(dispatch?.claimKey).toBe(seeded.claimKey);
		expect(dispatch?.error).toBe("gateway timeout");
		expect(dispatch?.providerOperationId).toBe("existing-op");
	});
});
