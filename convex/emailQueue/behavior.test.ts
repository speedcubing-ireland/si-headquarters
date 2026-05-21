import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import workpoolSchema from "../../node_modules/@convex-dev/workpool/dist/component/schema";

type SeededDispatchOverrides = {
	dedupeKey?: string;
	senderAddress?: string;
	claimKey?: string;
};

const workpoolModules = import.meta.glob<string[]>(
	"../../node_modules/@convex-dev/workpool/dist/component/**/!(*.*.*)*.*s",
);

function createHarness() {
	const t = convexTest(schema, modules);
	t.registerComponent("emailWorkpool", workpoolSchema, workpoolModules);
	return t;
}

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
		const t = createHarness();
		const seeded = await seedDispatch(t);

		const result = await t.query(internal.emailQueue.api._getDispatchForClaim, {
			dispatchId: seeded.dispatchId,
			claimKey: "claim:1",
		});

		expect(result?._id).toBe(seeded.dispatchId);
		expect(result?.status).toBe("sending");
		expect(result?.claimKey).toBe("claim:1");
		expect(result?.senderAddress).toBeUndefined();
	});

	test("_getDispatchForClaim returns senderAddress when set", async () => {
		const t = createHarness();
		const seeded = await seedDispatch(t, {
			senderAddress: "sponsorship@speedcubingireland.com",
		});

		const result = await t.query(internal.emailQueue.api._getDispatchForClaim, {
			dispatchId: seeded.dispatchId,
			claimKey: "claim:1",
		});

		expect(result?.senderAddress).toBe("sponsorship@speedcubingireland.com");
	});

	test("_enqueueDispatch persists senderAddress on the dispatch row", async () => {
		const t = createHarness();
		const result = await t.mutation(internal.emailQueue.api._enqueueDispatch, {
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
		const t = createHarness();
		const result = await t.mutation(internal.emailQueue.api._enqueueDispatch, {
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

	test("_enqueueDispatch mints claimKey and schedules _sendDispatch", async () => {
		const t = createHarness();
		const result = await t.mutation(internal.emailQueue.api._enqueueDispatch, {
			dedupeKey: "claim-and-schedule",
			sourceKind: "notification",
			templateKey: "notification_immediate",
			recipientEmail: "user@example.com",
			subject: "Subject",
			plainTextBody: "Hi",
		});

		expect(result.created).toBe(true);
		const stored = await t.run((ctx) => ctx.db.get(result.dispatchId));
		expect(stored?.claimKey).toBeDefined();
		expect(stored?.claimKey).toContain(String(result.dispatchId));
		// Scheduling is mediated by Workpool; we assert no throw and claimKey exists.
	});

	test("_enqueueDispatch paces newly queued emails", async () => {
		const previousInterval = process.env.EMAIL_SEND_INTERVAL_MS;
		process.env.EMAIL_SEND_INTERVAL_MS = "1000";
		try {
			const t = createHarness();
			const first = await t.mutation(internal.emailQueue.api._enqueueDispatch, {
				dedupeKey: "paced-1",
				sourceKind: "notification",
				templateKey: "notification_immediate",
				recipientEmail: "user@example.com",
				subject: "Subject",
				plainTextBody: "Hi",
			});
			const second = await t.mutation(
				internal.emailQueue.api._enqueueDispatch,
				{
					dedupeKey: "paced-2",
					sourceKind: "notification",
					templateKey: "notification_immediate",
					recipientEmail: "user@example.com",
					subject: "Subject",
					plainTextBody: "Hi",
				},
			);

			const rows = await t.run(async (ctx) => ({
				first: await ctx.db.get(first.dispatchId),
				second: await ctx.db.get(second.dispatchId),
			}));
			expect(rows.second?.scheduledFor).toBeGreaterThanOrEqual(
				(rows.first?.scheduledFor ?? 0) + 1000,
			);
		} finally {
			if (previousInterval === undefined) {
				delete process.env.EMAIL_SEND_INTERVAL_MS;
			} else {
				process.env.EMAIL_SEND_INTERVAL_MS = previousInterval;
			}
		}
	});

	test("_prepareDispatchSendAttempt increments real send attempts and eventually dead-letters", async () => {
		const t = createHarness();
		const seeded = await seedDispatch(t);
		await t.run((ctx) =>
			ctx.db.patch(seeded.dispatchId, {
				sendAttemptCount: 5,
				providerOperationClaimKey: undefined,
			}),
		);

		const operationId = await t.mutation(
			internal.emailQueue.api._prepareDispatchSendAttempt,
			{
				dispatchId: seeded.dispatchId,
				claimKey: "claim:1",
			},
		);
		expect(operationId).toBeTruthy();
		const afterSixth = await t.run((ctx) => ctx.db.get(seeded.dispatchId));
		expect(afterSixth?.sendAttemptCount).toBe(6);

		const exhausted = await t.mutation(
			internal.emailQueue.api._prepareDispatchSendAttempt,
			{
				dispatchId: seeded.dispatchId,
				claimKey: "claim:1",
			},
		);
		expect(exhausted).toBeNull();
		const final = await t.run((ctx) => ctx.db.get(seeded.dispatchId));
		expect(final?.status).toBe("dead_letter");
		expect(final?.error).toBe("send_attempts_exhausted");
	});

	test("_markSent accepts submitted rows and delivery events can still refine them", async () => {
		const t = createHarness();
		const seeded = await seedDispatch(t);
		await t.run((ctx) =>
			ctx.db.patch(seeded.dispatchId, {
				status: "submitted",
				submittedAt: Date.now(),
			}),
		);

		await t.mutation(internal.emailQueue.api._markSent, {
			dispatchId: seeded.dispatchId,
			claimKey: "claim:1",
			providerStatus: "Succeeded",
		});
		const sent = await t.run((ctx) => ctx.db.get(seeded.dispatchId));
		expect(sent?.status).toBe("sent");

		await t.mutation(internal.emailQueue.api._applyDeliveryEvent, {
			providerOperationId: sent?.providerOperationId ?? "",
			providerStatus: "Delivered",
		});
		const delivered = await t.run((ctx) => ctx.db.get(seeded.dispatchId));
		expect(delivered?.status).toBe("delivered");
	});

	test("_runSweep schedules fallback polls for stale submitted rows", async () => {
		const t = createHarness();
		const seeded = await seedDispatch(t);
		await t.run((ctx) =>
			ctx.db.patch(seeded.dispatchId, {
				status: "submitted",
				submittedAt: Date.now() - 10 * 60 * 1000,
				updatedAt: Date.now() - 10 * 60 * 1000,
			}),
		);

		const result = await t.mutation(internal.emailQueue.api._runSweep, {});
		expect(result.polled).toBe(1);
	});

	test("_replayDeadLetter preserves senderAddress from the original dispatch", async () => {
		const t = createHarness();
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

		const replay = await t.mutation(internal.emailQueue.api._replayDeadLetter, {
			deadLetterId,
		});
		const replayed = await t.run((ctx) => ctx.db.get(replay.dispatchId));
		expect(replayed?.senderAddress).toBe("sponsorship@speedcubingireland.com");
	});
});
