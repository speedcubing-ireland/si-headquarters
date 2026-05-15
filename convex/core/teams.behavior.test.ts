import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedDirector(
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

describe("teams behavior", () => {
	test("create team stores record with name and member IDs", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });
		const memberId = await t.run((ctx) => ctx.db.insert("users", {}));

		const teamId = await director.mutation(api.core.teams.create, {
			name: "New Team",
			memberIds: [memberId],
		});

		const doc = await t.run((ctx) => ctx.db.get("teams", teamId));
		expect(doc?.name).toBe("New Team");
		expect(doc?.memberIds).toEqual([memberId]);
	});

	test("update team changes name and memberIds", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		const teamId = await director.mutation(api.core.teams.create, {
			name: "Original",
		});
		const memberId = await t.run((ctx) => ctx.db.insert("users", {}));

		await director.mutation(api.core.teams.update, {
			teamId,
			name: "Renamed",
			memberIds: [memberId],
		});

		const doc = await t.run((ctx) => ctx.db.get("teams", teamId));
		expect(doc?.name).toBe("Renamed");
		expect(doc?.memberIds).toEqual([memberId]);
	});

	test("list returns all teams", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		await director.mutation(api.core.teams.create, { name: "Alpha" });
		await director.mutation(api.core.teams.create, { name: "Beta" });

		const rows = await director.query(api.core.teams.list, {});
		const names = rows.map((r: { name: string }) => r.name);
		expect(names).toContain("Alpha");
		expect(names).toContain("Beta");
	});

	test("get returns a single team by ID", async () => {
		const t = convexTest(schema, modules);
		const directorId = await seedDirector(t);
		const director = t.withIdentity({ subject: directorId });

		const teamId = await director.mutation(api.core.teams.create, {
			name: "Specific",
		});

		const doc = await director.query(api.core.teams.get, { teamId });
		expect(doc?.name).toBe("Specific");
	});

	test("create rejects non-directors", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });

		await expect(
			authed.mutation(api.core.teams.create, { name: "Should fail" }),
		).rejects.toBeTruthy();
	});
});
