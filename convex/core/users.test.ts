import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

test("users.getCurrentUser returns null when unauthenticated", async () => {
	const t = convexTest(schema, modules);
	const user = await t.query(api.core.users.getCurrentUser);
	expect(user).toBeNull();
});

test("t.run can insert and read from Convex tables", async () => {
	const t = convexTest(schema, modules);

	const row = await t.run(async (ctx) => {
		await ctx.db.insert("numbers", { value: 42 });
		return await ctx.db.query("numbers").first();
	});

	expect(row?.value).toBe(42);
});
