import { convexTest } from "convex-test";
import { KnownEmailSendStatus } from "@azure/communication-email";
import { describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import * as emailLib from "../lib/email";
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

	test("_runUnsentPollSweep claims due pending dispatches and upserts poller state", async () => {
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
				idempotencyKey: "dispatch:seeded:poll-sweep",
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

		const result = await t.mutation(
			internal.sponsorshipEmails._runUnsentPollSweep,
			{},
		);
		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		const pollerState = await t.run((ctx) =>
			ctx.db
				.query("sponsorshipEmailPollerState")
				.withIndex("by_key", (q) => q.eq("key", "default"))
				.first(),
		);

		expect(result.claimedPending).toBe(1);
		expect(result.nextDelayMs).toBe(60_000);
		expect(dispatch?.status).toBe("sending");
		expect(dispatch?.attempts).toBe(1);
		expect(typeof dispatch?.claimKey).toBe("string");
		expect(pollerState?.scheduledFunctionId).toBeDefined();
		expect(pollerState?.scheduledFor).toBeDefined();
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
				previousLastAttemptAt: dispatch?.lastAttemptAt ?? 0,
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
		expect(dispatch?.lastAttemptAt).toBe(seeded.previousLastAttemptAt);
	});

	test("_markDispatchTransientError does not persist unknown fallback errors", async () => {
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
				idempotencyKey: "dispatch:seeded:unknown-transient",
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
			error: "Unknown email error",
		});

		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		expect(dispatch?.status).toBe("sending");
		expect(dispatch?.error).toBeUndefined();
	});

	test("_deliverDispatch recovers a transient send timeout by polling operation status", async () => {
		const t = convexTest(schema, modules);
		const pollSendSpy = vi
			.spyOn(emailLib, "pollEmailSend")
			.mockRejectedValue(new Error("The operation was aborted"));
		const pollOperationSpy = vi
			.spyOn(emailLib, "pollEmailSendOperation")
			.mockResolvedValue({
				operationId: "existing-op",
				status: KnownEmailSendStatus.Succeeded,
				retryAfterMs: 15_000,
			});

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
				idempotencyKey: "dispatch:seeded:deliver-recovery",
				status: "sending",
				attempts: 1,
				maxAttempts: 5,
				scheduledFor: undefined,
				scheduledFunctionId: undefined,
				claimKey: undefined,
				lastAttemptAt: now - 1_000,
				providerOperationId: "existing-op",
				providerPollerState: undefined,
				sentAt: undefined,
				providerMessageId: undefined,
				error: undefined,
				createdAt: now - 60_000,
				updatedAt: now - 60_000,
			});
			const claimKey = `${dispatchId}:1:${now - 1_000}`;
			await ctx.db.patch("sponsorshipEmailDispatches", dispatchId, {
				claimKey,
			});
			return { dispatchId, claimKey };
		});

		try {
			await t.action(internal.sponsorshipEmails._deliverDispatch, {
				dispatchId: seeded.dispatchId,
				claimKey: seeded.claimKey,
			});
		} finally {
			pollSendSpy.mockRestore();
			pollOperationSpy.mockRestore();
		}

		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		expect(dispatch?.status).toBe("sent");
		expect(dispatch?.providerMessageId).toBe("existing-op");
		expect(dispatch?.error).toBeUndefined();
	});

	test("_pollDispatchDelivery keeps transient transport failures as sending", async () => {
		const t = convexTest(schema, modules);
		const pollOperationSpy = vi
			.spyOn(emailLib, "pollEmailSendOperation")
			.mockRejectedValue(new Error("The operation was aborted"));

		const seeded = await t.run(async (ctx) => {
			const now = Date.now();
			const staleClaimTimestamp = now - 4 * 60 * 1000;
			const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
				auctionId: undefined,
				sponsorId: undefined,
				emailType: "invite",
				recipient: "sponsor@example.com",
				recipientName: "Sponsor",
				subject: "Invite",
				message: "Welcome",
				contextJson: undefined,
				idempotencyKey: "dispatch:seeded:transient-stale-finalize",
				status: "sending",
				attempts: 1,
				maxAttempts: 5,
				scheduledFor: undefined,
				scheduledFunctionId: undefined,
				claimKey: undefined,
				lastAttemptAt: now - 4 * 60 * 1000,
				providerOperationId: "existing-op",
				providerPollerState: "existing-state",
				sentAt: undefined,
				providerMessageId: undefined,
				error: undefined,
				createdAt: now - 5 * 60 * 1000,
				updatedAt: now - 60_000,
			});
			const claimKey = `${dispatchId}:1:${staleClaimTimestamp}`;
			await ctx.db.patch("sponsorshipEmailDispatches", dispatchId, {
				claimKey,
			});
			return { dispatchId, claimKey };
		});

		try {
			await t.action(internal.sponsorshipEmails._pollDispatchDelivery, {
				dispatchId: seeded.dispatchId,
				claimKey: seeded.claimKey,
			});
		} finally {
			pollOperationSpy.mockRestore();
		}

		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		expect(dispatch?.status).toBe("sending");
		expect(dispatch?.providerMessageId).toBeUndefined();
		expect(dispatch?.error).toBe("The operation was aborted");
	});

	test("_pollDispatchDelivery does not assume sent for stale rate-limit responses", async () => {
		const t = convexTest(schema, modules);
		const rateLimitError = Object.assign(new Error("Too many requests"), {
			statusCode: 429,
		});
		const pollOperationSpy = vi
			.spyOn(emailLib, "pollEmailSendOperation")
			.mockRejectedValue(rateLimitError);

		const seeded = await t.run(async (ctx) => {
			const now = Date.now();
			const staleClaimTimestamp = now - 4 * 60 * 1000;
			const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
				auctionId: undefined,
				sponsorId: undefined,
				emailType: "invite",
				recipient: "sponsor@example.com",
				recipientName: "Sponsor",
				subject: "Invite",
				message: "Welcome",
				contextJson: undefined,
				idempotencyKey: "dispatch:seeded:rate-limit-stale",
				status: "sending",
				attempts: 1,
				maxAttempts: 5,
				scheduledFor: undefined,
				scheduledFunctionId: undefined,
				claimKey: undefined,
				lastAttemptAt: now - 4 * 60 * 1000,
				providerOperationId: "existing-op",
				providerPollerState: "existing-state",
				sentAt: undefined,
				providerMessageId: undefined,
				error: undefined,
				createdAt: now - 5 * 60 * 1000,
				updatedAt: now - 60_000,
			});
			const claimKey = `${dispatchId}:1:${staleClaimTimestamp}`;
			await ctx.db.patch("sponsorshipEmailDispatches", dispatchId, {
				claimKey,
			});
			return { dispatchId, claimKey };
		});

		try {
			await t.action(internal.sponsorshipEmails._pollDispatchDelivery, {
				dispatchId: seeded.dispatchId,
				claimKey: seeded.claimKey,
			});
		} finally {
			pollOperationSpy.mockRestore();
		}

		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		expect(dispatch?.status).toBe("sending");
		expect(dispatch?.providerMessageId).toBeUndefined();
		expect(dispatch?.error).toBe("Too many requests");
	});

	test("_pollDispatchDelivery keeps sending for non-terminal provider status with a heartbeat", async () => {
		const t = convexTest(schema, modules);
		const pollOperationSpy = vi
			.spyOn(emailLib, "pollEmailSendOperation")
			.mockResolvedValue({
				operationId: "existing-op",
				status: KnownEmailSendStatus.Running,
				retryAfterMs: 15_000,
			});

		const seeded = await t.run(async (ctx) => {
			const now = Date.now();
			const staleClaimTimestamp = now - 11 * 60 * 1000;
			const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
				auctionId: undefined,
				sponsorId: undefined,
				emailType: "invite",
				recipient: "sponsor@example.com",
				recipientName: "Sponsor",
				subject: "Invite",
				message: "Welcome",
				contextJson: undefined,
				idempotencyKey: "dispatch:seeded:running-progress",
				status: "sending",
				attempts: 1,
				maxAttempts: 5,
				scheduledFor: undefined,
				scheduledFunctionId: undefined,
				claimKey: undefined,
				lastAttemptAt: now - 2_000,
				providerOperationId: "existing-op",
				providerPollerState: "existing-state",
				sentAt: undefined,
				providerMessageId: undefined,
				error: undefined,
				createdAt: now - 60_000,
				updatedAt: now - 60_000,
			});
			const claimKey = `${dispatchId}:1:${staleClaimTimestamp}`;
			await ctx.db.patch("sponsorshipEmailDispatches", dispatchId, {
				claimKey,
			});
			return { dispatchId, claimKey, previousLastAttemptAt: now - 2_000 };
		});

		try {
			await t.action(internal.sponsorshipEmails._pollDispatchDelivery, {
				dispatchId: seeded.dispatchId,
				claimKey: seeded.claimKey,
			});
		} finally {
			pollOperationSpy.mockRestore();
		}

		const dispatch = await t.run((ctx) =>
			ctx.db.get("sponsorshipEmailDispatches", seeded.dispatchId),
		);
		expect(dispatch?.status).toBe("sending");
		expect(dispatch?.providerOperationId).toBe("existing-op");
		expect(dispatch?.attempts).toBe(1);
		expect(dispatch?.error).toBeUndefined();
		expect((dispatch?.lastAttemptAt ?? 0) > seeded.previousLastAttemptAt).toBe(
			true,
		);
	});
});
