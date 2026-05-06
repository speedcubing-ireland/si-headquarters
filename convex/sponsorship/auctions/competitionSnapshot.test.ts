import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, components } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import sponsorAuthSchema from "../../sponsorAuth/schema";
import { modules } from "../../test.setup";
import { captureError, getConvexErrorCode } from "../../test_utils/convexError";

const sponsorAuthModules = import.meta.glob<string[]>(
	"../../sponsorAuth/**/!(*.*.*)*.*s",
);

function createHarness() {
	const t = convexTest(schema, modules);
	t.registerComponent("sponsorAuth", sponsorAuthSchema, sponsorAuthModules);
	return t;
}

async function seedSponsorAccess(
	t: ReturnType<typeof convexTest>,
	input: { auctionState: "draft" | "scheduled" | "active" | "closed" },
) {
	const now = Date.now();
	const ownerId = await t.run((ctx) => ctx.db.insert("users", {}));
	const competitionId = await t.run((ctx) =>
		ctx.db.insert("competitions", {
			name: "Snapshot Test Open",
			description: "",
			compStart: "2026-09-01",
			compEnd: "2026-09-02",
			organiserIds: [ownerId],
			updatedAt: now,
		}),
	);
	const sponsorAuthUser = (await t.mutation(components.sponsorAuth.adapter.create, {
		input: {
			model: "user",
			data: {
				email: "sponsor@example.com",
				name: "Snapshot Sponsor",
				emailVerified: true,
				createdAt: now,
				updatedAt: now,
			},
		},
	})) as { _id: string };
	const sponsorId = await t.run((ctx) =>
		ctx.db.insert("sponsors", {
			name: "Snapshot Sponsor Ltd",
			email: "sponsor@example.com",
			emailNormalized: "sponsor@example.com",
			authUserId: sponsorAuthUser._id,
			active: true,
			createdById: ownerId,
			updatedById: ownerId,
			updatedAt: now,
		}),
	);
	const sessionToken = "snapshot-session-token";
	await t.mutation(components.sponsorAuth.adapter.create, {
		input: {
			model: "session",
			data: {
				token: sessionToken,
				userId: sponsorAuthUser._id,
				expiresAt: now + 60 * 60 * 1000,
				createdAt: now,
				updatedAt: now,
			},
		},
	});
	const auctionId = await t.run((ctx) =>
		ctx.db.insert("sponsorshipAuctions", {
			competitionId,
			framework: "first_sealed",
			state: input.auctionState,
			currency: "EUR",
			startsAt: now - 60_000,
			endsAt: now + 60_000,
			antiSnipingWindowMs: 300_000,
			antiSnipingExtendMs: 300_000,
			startPriceCents: 1_000,
			competitionSnapshot: {
				summary: {
					name: "Snapshot Test Open",
					address: "",
					startDate: "2026-09-01",
					endDate: "2026-09-02",
					eventIds: [],
				},
				source: "competition_record",
				fetchedAt: now,
			},
			createdById: ownerId as Id<"users">,
			updatedById: ownerId as Id<"users">,
			updatedAt: now,
		}),
	);
	await t.run((ctx) =>
		ctx.db.insert("sponsorshipAuctionInvites", {
			auctionId,
			sponsorId,
			invitedById: ownerId,
			invitedAt: now,
		}),
	);
	return { auctionId, sessionToken };
}

describe("refreshCompetitionSnapshot authorization", () => {
	test("rejects invited sponsors when the auction is hidden", async () => {
		const t = createHarness();
		const { auctionId, sessionToken } = await seedSponsorAccess(t, {
			auctionState: "draft",
		});

		const error = await captureError(() =>
			t.action(api.sponsorshipAuctions.refreshCompetitionSnapshot, {
				auctionId,
				sessionToken,
			}),
		);

		expect(getConvexErrorCode(error)).toBe("FORBIDDEN");
	});

	test("allows invited sponsors to refresh visible auctions", async () => {
		const t = createHarness();
		const { auctionId, sessionToken } = await seedSponsorAccess(t, {
			auctionState: "scheduled",
		});

		const result = await t.action(api.sponsorshipAuctions.refreshCompetitionSnapshot, {
			auctionId,
			sessionToken,
		});

		expect(result.status).toBe("missing_wca_link");
	});
});
