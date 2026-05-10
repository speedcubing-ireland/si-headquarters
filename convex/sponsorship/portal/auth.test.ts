import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, components } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import sponsorAuthSchema from "../../sponsorAuth/schema";
import { modules } from "../../test.setup";

const sponsorAuthModules = import.meta.glob<string[]>(
	"../../sponsorAuth/**/!(*.*.*)*.*s",
);

function createHarness() {
	const t = convexTest(schema, modules);
	t.registerComponent("sponsorAuth", sponsorAuthSchema, sponsorAuthModules);
	return t;
}

async function seedSponsorSession(t: ReturnType<typeof convexTest>) {
	const ownerId = await t.run((ctx) =>
		ctx.db.insert("users", { email: "owner@example.com" }),
	);
	const now = Date.now();
	const sponsorAuthUser = (await t.mutation(
		components.sponsorAuth.adapter.create,
		{
			input: {
				model: "user",
				data: {
					email: "sponsor@example.com",
					name: "Portal Sponsor",
					emailVerified: true,
					createdAt: now,
					updatedAt: now,
				},
			},
		},
	)) as { _id: string };
	const sponsorId = await t.run((ctx) =>
		ctx.db.insert("sponsors", {
			name: "Canonical Sponsor Ltd",
			email: "sponsor@example.com",
			emailNormalized: "sponsor@example.com",
			authUserId: sponsorAuthUser._id,
			active: true,
			createdById: ownerId as Id<"users">,
			updatedById: ownerId as Id<"users">,
			updatedAt: now,
		}),
	);
	const sessionToken = "sponsor-session-token";
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
	return { sessionToken, sponsorId, sponsorAuthUserId: sponsorAuthUser._id };
}

describe("sponsor portal profile auth", () => {
	test("display name updates auth profile without mutating sponsor name", async () => {
		const t = createHarness();
		const { sessionToken, sponsorId, sponsorAuthUserId } =
			await seedSponsorSession(t);

		await t.mutation(api.sponsorPortal.updateDisplayName, {
			sessionToken,
			displayName: "Updated Portal Name",
		});

		const [me, sponsorDoc, sponsorAuthUser] = await Promise.all([
			t.query(api.sponsorPortal.me, { sessionToken }),
			t.run((ctx) => ctx.db.get("sponsors", sponsorId)),
			t.query(components.sponsorAuth.adapter.findOne, {
				model: "user",
				where: [{ field: "_id", value: sponsorAuthUserId }],
			}),
		]);

		expect(me?.name).toBe("Updated Portal Name");
		expect(sponsorDoc?.name).toBe("Canonical Sponsor Ltd");
		expect((sponsorAuthUser as { name?: string } | null)?.name).toBe(
			"Updated Portal Name",
		);
	});
});
