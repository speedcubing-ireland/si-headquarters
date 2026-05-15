import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { TEAM_NAMES } from "./lib/constants";
import schema from "./schema";
import sponsorAuthSchema from "./sponsorship/auth/component/sponsorAuth/schema";
import { modules } from "./test.setup";
import { captureError, getConvexErrorCode } from "./test_utils/convexError";

const sponsorAuthModules = import.meta.glob<string[]>(
	"./sponsorship/auth/component/sponsorAuth/**/!(*.*.*)*.*s",
);

type DirectorFixture = {
	directorId: Id<"users">;
	targetUserId: Id<"users">;
	activeSponsorId: Id<"sponsors">;
};

function createHarness({
	withSponsorAuth = false,
}: {
	withSponsorAuth?: boolean;
} = {}) {
	const t = convexTest(schema, modules);
	if (withSponsorAuth) {
		t.registerComponent("sponsorAuth", sponsorAuthSchema, sponsorAuthModules);
	}
	return t;
}

async function seedDirectorFixture(
	t: ReturnType<typeof convexTest>,
): Promise<DirectorFixture> {
	return t.run(async (ctx) => {
		const now = Date.now();
		const directorId = await ctx.db.insert("users", {
			email: "director@example.com",
		});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.DIRECTORS,
			memberIds: [directorId],
		});
		const targetUserId = await ctx.db.insert("users", {
			email: "target.user@example.com",
			name: "Target User",
		});
		const activeSponsorId = await ctx.db.insert("sponsors", {
			name: "Sponsor One",
			email: "sponsor.one@example.com",
			emailNormalized: "sponsor.one@example.com",
			active: true,
			createdById: directorId,
			updatedById: directorId,
			updatedAt: now,
		});
		return {
			directorId,
			targetUserId,
			activeSponsorId,
		};
	});
}

function extractTicket(url: string): string {
	const parsed = new URL(url);
	const ticket = parsed.searchParams.get("ticket");
	if (!ticket) {
		throw new Error("missing ticket query parameter");
	}
	return ticket;
}

describe("admin impersonation security", () => {
	test("non-director cannot create impersonation links", async () => {
		const t = createHarness();
		const regularUserId = await t.run((ctx) =>
			ctx.db.insert("users", { email: "regular@example.com" }),
		);
		const targetUserId = await t.run((ctx) =>
			ctx.db.insert("users", { email: "target@example.com" }),
		);
		const regularUser = t.withIdentity({ subject: regularUserId });
		const capturedError = await captureError(() =>
			regularUser.mutation(api.admin.createImpersonationLoginLink, {
				targetType: "user",
				userId: targetUserId,
			}),
		);

		expect(capturedError).toBeTruthy();
		expect(getConvexErrorCode(capturedError)).toBe("FORBIDDEN");
	});

	test("non-director cannot list impersonation targets", async () => {
		const t = createHarness();
		const regularUserId = await t.run((ctx) =>
			ctx.db.insert("users", { email: "regular.list@example.com" }),
		);
		const regularUser = t.withIdentity({ subject: regularUserId });
		const capturedError = await captureError(() =>
			regularUser.query(api.admin.listImpersonationTargets, {}),
		);

		expect(capturedError).toBeTruthy();
		expect(getConvexErrorCode(capturedError)).toBe("FORBIDDEN");
	});

	test("createImpersonationLoginLink stores hashed one-time ticket", async () => {
		const t = createHarness();
		const { directorId, targetUserId } = await seedDirectorFixture(t);
		const director = t.withIdentity({ subject: directorId });

		const result = await director.mutation(
			api.admin.createImpersonationLoginLink,
			{
				targetType: "user",
				userId: targetUserId,
			},
		);
		const ticket = extractTicket(result.url);

		const rows = await t.run((ctx) =>
			ctx.db.query("adminImpersonationTickets").collect(),
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.tokenHash).toHaveLength(64);
		expect(rows[0]?.tokenHash).not.toBe(ticket);
		expect(rows[0]?.targetType).toBe("user");
		expect(rows[0]?.userId).toBe(targetUserId);
		expect(rows[0]?.usedAt).toBeUndefined();
		expect(rows[0]?.consumedByNonceHash).toBeUndefined();
		expect(result.targetType).toBe("user");
		expect(result.targetName).toBe("Target User");
	});

	test("consuming user ticket is idempotent for same nonce and blocks replay with another nonce", async () => {
		const t = createHarness();
		const { directorId, targetUserId } = await seedDirectorFixture(t);
		const director = t.withIdentity({ subject: directorId });
		const { url } = await director.mutation(
			api.admin.createImpersonationLoginLink,
			{
				targetType: "user",
				userId: targetUserId,
			},
		);
		const ticket = extractTicket(url);

		const firstConsume = await t.mutation(
			internal.admin.consumeUserImpersonationTicket,
			{
				ticket,
				consumptionNonce: "nonce-fixed-for-strict-mode-1234",
			},
		);
		const secondConsumeSameNonce = await t.mutation(
			internal.admin.consumeUserImpersonationTicket,
			{
				ticket,
				consumptionNonce: "nonce-fixed-for-strict-mode-1234",
			},
		);

		expect(firstConsume.userId).toBe(targetUserId);
		expect(secondConsumeSameNonce.userId).toBe(targetUserId);
		const capturedError = await captureError(() =>
			t.mutation(internal.admin.consumeUserImpersonationTicket, {
				ticket,
				consumptionNonce: "another-nonce-different-5678",
			}),
		);

		expect(capturedError).toBeTruthy();
		expect(getConvexErrorCode(capturedError)).toBe("UNAUTHENTICATED");

		const row = await t.run((ctx) =>
			ctx.db.query("adminImpersonationTickets").unique(),
		);
		expect(row?.usedAt).toBeTypeOf("number");
		expect(row?.consumedByNonceHash).toHaveLength(64);
		expect(row?.consumedByNonceHash).not.toBe(
			"nonce-fixed-for-strict-mode-1234",
		);
	});

	test("expired user ticket cannot be consumed", async () => {
		const t = createHarness();
		const { directorId, targetUserId } = await seedDirectorFixture(t);
		const director = t.withIdentity({ subject: directorId });
		const now = new Date("2026-01-10T10:00:00.000Z");
		vi.setSystemTime(now);

		const { url, expiresAt } = await director.mutation(
			api.admin.createImpersonationLoginLink,
			{
				targetType: "user",
				userId: targetUserId,
			},
		);
		const ticket = extractTicket(url);
		vi.setSystemTime(new Date(expiresAt + 1));
		const capturedError = await captureError(() =>
			t.mutation(internal.admin.consumeUserImpersonationTicket, {
				ticket,
				consumptionNonce: "nonce-expired-ticket-12345",
			}),
		);

		expect(capturedError).toBeTruthy();
		expect(getConvexErrorCode(capturedError)).toBe("UNAUTHENTICATED");
		vi.useRealTimers();
	});

	test("sponsor ticket consumption is idempotent for same nonce and blocks replay with another nonce", async () => {
		const previousSponsorBetterAuthSecret =
			process.env.SPONSOR_BETTER_AUTH_SECRET;
		process.env.SPONSOR_BETTER_AUTH_SECRET =
			"test-sponsor-better-auth-secret-1234567890";

		const t = createHarness({ withSponsorAuth: true });

		try {
			const { directorId, activeSponsorId } = await seedDirectorFixture(t);
			const director = t.withIdentity({ subject: directorId });
			const { url, targetType } = await director.mutation(
				api.admin.createImpersonationLoginLink,
				{
					targetType: "sponsor",
					sponsorId: activeSponsorId,
				},
			);
			expect(targetType).toBe("sponsor");

			const ticket = extractTicket(url);
			const firstConsume = await t.mutation(
				api.admin.consumeSponsorImpersonationTicket,
				{
					ticket,
					consumptionNonce: "sponsor-nonce-fixed-123456",
				},
			);
			const secondConsumeSameNonce = await t.mutation(
				api.admin.consumeSponsorImpersonationTicket,
				{
					ticket,
					consumptionNonce: "sponsor-nonce-fixed-123456",
				},
			);

			expect(firstConsume.oneTimeToken).toHaveLength(64);
			expect(secondConsumeSameNonce.oneTimeToken).toBe(
				firstConsume.oneTimeToken,
			);
			const capturedError = await captureError(() =>
				t.mutation(api.admin.consumeSponsorImpersonationTicket, {
					ticket,
					consumptionNonce: "sponsor-nonce-different-987654",
				}),
			);

			expect(capturedError).toBeTruthy();
			expect(getConvexErrorCode(capturedError)).toBe("UNAUTHENTICATED");
		} finally {
			if (previousSponsorBetterAuthSecret === undefined) {
				delete process.env.SPONSOR_BETTER_AUTH_SECRET;
			} else {
				process.env.SPONSOR_BETTER_AUTH_SECRET =
					previousSponsorBetterAuthSecret;
			}
		}
	});

	test("invalid nonce and mixed target IDs are rejected", async () => {
		const t = createHarness();
		const { directorId, targetUserId, activeSponsorId } =
			await seedDirectorFixture(t);
		const director = t.withIdentity({ subject: directorId });
		const mixedIdsError = await captureError(() =>
			director.mutation(api.admin.createImpersonationLoginLink, {
				targetType: "user",
				userId: targetUserId,
				sponsorId: activeSponsorId,
			}),
		);

		expect(mixedIdsError).toBeTruthy();
		expect(getConvexErrorCode(mixedIdsError)).toBe("BAD_REQUEST");

		const { url } = await director.mutation(
			api.admin.createImpersonationLoginLink,
			{
				targetType: "user",
				userId: targetUserId,
			},
		);
		const ticket = extractTicket(url);
		const shortNonceError = await captureError(() =>
			t.mutation(internal.admin.consumeUserImpersonationTicket, {
				ticket,
				consumptionNonce: "short",
			}),
		);

		expect(shortNonceError).toBeTruthy();
		expect(getConvexErrorCode(shortNonceError)).toBe("BAD_REQUEST");
	});

	test("expired sponsor ticket cannot be consumed", async () => {
		const previousSponsorBetterAuthSecret =
			process.env.SPONSOR_BETTER_AUTH_SECRET;
		process.env.SPONSOR_BETTER_AUTH_SECRET =
			"test-sponsor-better-auth-secret-1234567890";

		const t = createHarness({ withSponsorAuth: true });

		try {
			const { directorId, activeSponsorId } = await seedDirectorFixture(t);
			const director = t.withIdentity({ subject: directorId });
			const now = new Date("2026-01-10T10:00:00.000Z");
			vi.setSystemTime(now);

			const { url, expiresAt } = await director.mutation(
				api.admin.createImpersonationLoginLink,
				{
					targetType: "sponsor",
					sponsorId: activeSponsorId,
				},
			);
			const ticket = extractTicket(url);
			vi.setSystemTime(new Date(expiresAt + 1));

			const capturedError = await captureError(() =>
				t.mutation(api.admin.consumeSponsorImpersonationTicket, {
					ticket,
					consumptionNonce: "sponsor-expired-nonce-12345",
				}),
			);

			expect(capturedError).toBeTruthy();
			expect(getConvexErrorCode(capturedError)).toBe("UNAUTHENTICATED");
		} finally {
			vi.useRealTimers();
			if (previousSponsorBetterAuthSecret === undefined) {
				delete process.env.SPONSOR_BETTER_AUTH_SECRET;
			} else {
				process.env.SPONSOR_BETTER_AUTH_SECRET =
					previousSponsorBetterAuthSecret;
			}
		}
	});

	test("user ticket cannot be consumed via sponsor endpoint", async () => {
		const t = createHarness();
		const { directorId, targetUserId } = await seedDirectorFixture(t);
		const director = t.withIdentity({ subject: directorId });
		const { url } = await director.mutation(
			api.admin.createImpersonationLoginLink,
			{
				targetType: "user",
				userId: targetUserId,
			},
		);
		const ticket = extractTicket(url);

		const capturedError = await captureError(() =>
			t.mutation(api.admin.consumeSponsorImpersonationTicket, {
				ticket,
				consumptionNonce: "wrong-endpoint-nonce-12345",
			}),
		);

		expect(capturedError).toBeTruthy();
		expect(getConvexErrorCode(capturedError)).toBe("UNAUTHENTICATED");
	});
});
