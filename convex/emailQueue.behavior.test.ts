import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("emailQueue behavior", () => {
	test("_getDispatchForClaim returns validator-safe dispatch shape", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const now = Date.now();
			const dispatchId = await ctx.db.insert("emailDispatches", {
				dedupeKey: "k1",
				sourceKind: "notification",
				sourceRef: "notification_group:u1:immediate:k1",
				templateKey: "notification_immediate",
				recipientEmail: "user@example.com",
				recipientName: "User",
				subject: "Subject",
				htmlBody: "<p>Hi</p>",
				plainTextBody: "Hi",
				payloadJson: "{}",
				scheduledFor: now,
				status: "sending",
				claimKey: "claim:1",
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

		const result = await t.query(internal.emailQueue._getDispatchForClaim, {
			dispatchId: seeded.dispatchId,
			claimKey: "claim:1",
		});

		expect(result?._id).toBe(seeded.dispatchId);
		expect(result?.status).toBe("sending");
		expect(result?.claimKey).toBe("claim:1");
	});
});
