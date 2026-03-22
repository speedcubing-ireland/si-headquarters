import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { TEAM_NAMES } from "./lib/constants";

async function seedUser(t: ReturnType<typeof convexTest>): Promise<Id<"users">> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			name: "Original Name",
		});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [userId],
		});
		return userId;
	});
}

describe("user account behavior", () => {
	test("updateCurrentUserName changes display name", async () => {
		const t = convexTest(schema, modules);
		const userId = await seedUser(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.users.updateCurrentUserName, {
			name: "New Display Name",
		});

		const user = await t.run((ctx) => ctx.db.get("users", userId));
		expect(user?.name).toBe("New Display Name");
	});

	test("updateCurrentUserName trims whitespace", async () => {
		const t = convexTest(schema, modules);
		const userId = await seedUser(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.users.updateCurrentUserName, {
			name: "  Padded Name  ",
		});

		const user = await t.run((ctx) => ctx.db.get("users", userId));
		expect(user?.name).toBe("Padded Name");
	});

	test("rerollCurrentUserAvatar generates a new avatar URL", async () => {
		const t = convexTest(schema, modules);
		const userId = await seedUser(t);
		const authed = t.withIdentity({ subject: userId });

		// First reroll to set an avatar
		await authed.mutation(api.users.rerollCurrentUserAvatar, {});
		const first = await t.run((ctx) => ctx.db.get("users", userId));
		expect(first?.image).toBeTruthy();

		// Second reroll should generate a different avatar
		await authed.mutation(api.users.rerollCurrentUserAvatar, {});
		const second = await t.run((ctx) => ctx.db.get("users", userId));
		expect(second?.image).toBeTruthy();
	});
});
