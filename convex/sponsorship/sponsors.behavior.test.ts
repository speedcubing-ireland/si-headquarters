import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

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

		const sponsorId = await manager.mutation(
			api.sponsorship.sponsors.create,
			{
				name: "Acme Corp",
				email: " Sponsor@EXAMPLE.com ",
			},
		);

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

		await manager.mutation(api.sponsorship.sponsors.create, {
			name: "First",
			email: "dup@example.com",
		});

		await expect(
			manager.mutation(api.sponsorship.sponsors.create, {
				name: "Second",
				email: "DUP@example.com",
			}),
		).rejects.toBeTruthy();
	});

	test("update changes sponsor name and email", async () => {
		const t = convexTest(schema, modules);
		const managerId = await seedSponsorshipManager(t);
		const manager = t.withIdentity({ subject: managerId });

		const sponsorId = await manager.mutation(
			api.sponsorship.sponsors.create,
			{
				name: "Old Name",
				email: "old@example.com",
			},
		);

		await manager.mutation(api.sponsorship.sponsors.update, {
			sponsorId,
			name: "New Name",
			email: "new@example.com",
		});

		const doc = await t.run((ctx) => ctx.db.get("sponsors", sponsorId));
		expect(doc?.name).toBe("New Name");
		expect(doc?.email).toBe("new@example.com");
	});
});
