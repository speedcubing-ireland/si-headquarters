import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

type SeededDispatchOverrides = {
	dedupeKey?: string;
	senderAddress?: string;
	claimKey?: string;
};

async function seedDispatch(
	t: ReturnType<typeof convexTest>,
	overrides: SeededDispatchOverrides = {},
) {
	return t.run(async (ctx) => {
		const now = Date.now();
		const dispatchId = await ctx.db.insert("emailDispatches", {
			dedupeKey: overrides.dedupeKey ?? "k1",
			sourceKind: "notification",
			sourceRef: "notification_group:u1:immediate:k1",
			templateKey: "notification_immediate",
			recipientEmail: "user@example.com",
			recipientName: "User",
			senderAddress: overrides.senderAddress,
			subject: "Subject",
			htmlBody: "<p>Hi</p>",
			plainTextBody: "Hi",
			payloadJson: "{}",
			scheduledFor: now,
			status: "sending",
			claimKey: overrides.claimKey ?? "claim:1",
			providerOperationId: "11111111-1111-5111-8111-111111111111",
			providerStatus: undefined,
			providerPollerState: undefined,
			sendAttemptCount: 1,
			pollAttemptCount: 0,
			lastProviderCheckAt: undefined,
			sentAt: undefined,
			error: undefined,
			deadLetteredAt: undefined,
			createdAt: now,
			updatedAt: now,
		});
		return { dispatchId };
	});
}

describe("emailQueue behavior", () => {
	test("_getDispatchForClaim returns validator-safe dispatch shape", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedDispatch(t);

		const result = await t.query(internal.emailQueue._getDispatchForClaim, {
			dispatchId: seeded.dispatchId,
			claimKey: "claim:1",
		});

		expect(result?._id).toBe(seeded.dispatchId);
		expect(result?.status).toBe("sending");
		expect(result?.claimKey).toBe("claim:1");
		expect(result?.senderAddress).toBeUndefined();
	});

	test("_getDispatchForClaim returns senderAddress when set", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedDispatch(t, {
			senderAddress: "sponsorship@speedcubingireland.com",
		});

		const result = await t.query(internal.emailQueue._getDispatchForClaim, {
			dispatchId: seeded.dispatchId,
			claimKey: "claim:1",
		});

		expect(result?.senderAddress).toBe("sponsorship@speedcubingireland.com");
	});

	test("_enqueueDispatch persists senderAddress on the dispatch row", async () => {
		const t = convexTest(schema, modules);
		const result = await t.mutation(internal.emailQueue._enqueueDispatch, {
			dedupeKey: "with-sender",
			sourceKind: "sponsorship",
			templateKey: "sponsorship_email",
			recipientEmail: "user@example.com",
			recipientName: "User",
			senderAddress: "sponsorship@speedcubingireland.com",
			subject: "Subject",
			plainTextBody: "Hi",
		});

		expect(result.created).toBe(true);
		const stored = await t.run((ctx) => ctx.db.get(result.dispatchId));
		expect(stored?.senderAddress).toBe("sponsorship@speedcubingireland.com");
	});

	test("_enqueueDispatch leaves senderAddress undefined when omitted", async () => {
		const t = convexTest(schema, modules);
		const result = await t.mutation(internal.emailQueue._enqueueDispatch, {
			dedupeKey: "no-sender",
			sourceKind: "notification",
			templateKey: "notification_immediate",
			recipientEmail: "user@example.com",
			subject: "Subject",
			plainTextBody: "Hi",
		});

		const stored = await t.run((ctx) => ctx.db.get(result.dispatchId));
		expect(stored?.senderAddress).toBeUndefined();
	});

	test("_replayDeadLetter preserves senderAddress from the original dispatch", async () => {
		const t = convexTest(schema, modules);
		const { deadLetterId } = await t.run(async (ctx) => {
			const now = Date.now();
			const dispatchId = await ctx.db.insert("emailDispatches", {
				dedupeKey: "dl-key",
				sourceKind: "sponsorship",
				sourceRef: "auction:1",
				templateKey: "sponsorship_email",
				recipientEmail: "user@example.com",
				recipientName: "User",
				senderAddress: "sponsorship@speedcubingireland.com",
				subject: "Subject",
				htmlBody: "<p>Hi</p>",
				plainTextBody: "Hi",
				payloadJson: undefined,
				scheduledFor: now,
				status: "dead_letter",
				claimKey: undefined,
				providerOperationId: "22222222-2222-5222-8222-222222222222",
				providerStatus: "failed",
				providerPollerState: undefined,
				sendAttemptCount: 1,
				pollAttemptCount: 0,
				lastProviderCheckAt: undefined,
				sentAt: undefined,
				error: "boom",
				deadLetteredAt: now,
				createdAt: now,
				updatedAt: now,
			});
			const deadLetterId = await ctx.db.insert("emailDeadLetters", {
				dispatchId,
				dedupeKey: "dl-key",
				sourceKind: "sponsorship",
				sourceRef: "auction:1",
				templateKey: "sponsorship_email",
				recipientEmail: "user@example.com",
				subject: "Subject",
				error: "boom",
				providerOperationId: "22222222-2222-5222-8222-222222222222",
				providerStatus: "failed",
				payloadJson: undefined,
				sendAttemptCount: 1,
				pollAttemptCount: 0,
				failedAt: now,
				replayCount: 0,
			});
			return { deadLetterId };
		});

		const replay = await t.mutation(internal.emailQueue._replayDeadLetter, {
			deadLetterId,
		});
		const replayed = await t.run((ctx) => ctx.db.get(replay.dispatchId));
		expect(replayed?.senderAddress).toBe("sponsorship@speedcubingireland.com");
	});
});
