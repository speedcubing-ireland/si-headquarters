import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

async function seedUpdate(t: ReturnType<typeof convexTest>): Promise<{
	allowedUserId: Id<"users">;
	deniedUserId: Id<"users">;
	updateId: Id<"competitionUpdates">;
}> {
	return t.run(async (ctx) => {
		const now = Date.now();
		const allowedUserId = await ctx.db.insert("users", {});
		const deniedUserId = await ctx.db.insert("users", {});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-11-01",
			compEnd: "2026-11-02",
			organiserIds: [allowedUserId],
			updatedAt: now,
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId: allowedUserId,
		});
		const updateId = await ctx.db.insert("competitionUpdates", {
			competitionId,
			authorId: allowedUserId,
			status: "on-track",
			message: "Seed update",
			reactions: [],
			updatedAt: now,
		});
		return { allowedUserId, deniedUserId, updateId };
	});
}

describe("updates behavior characterization", () => {
	test("addReaction rejects users without competition access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedUpdate(t);
		const denied = t.withIdentity({ subject: seeded.deniedUserId });

		await expect(
			denied.mutation(api.updates.addReaction, {
				updateId: seeded.updateId,
				emoji: "👍",
			}),
		).rejects.toBeTruthy();

		const update = await t.run((ctx) =>
			ctx.db.get("competitionUpdates", seeded.updateId),
		);
		expect(update?.reactions).toEqual([]);
	});

	test("addReaction allows users with competition access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedUpdate(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });

		await allowed.mutation(api.updates.addReaction, {
			updateId: seeded.updateId,
			emoji: "👍",
		});

		const update = await t.run((ctx) =>
			ctx.db.get("competitionUpdates", seeded.updateId),
		);
		expect(update?.reactions).toHaveLength(1);
		expect(update?.reactions[0]?.emoji).toBe("👍");
		expect(update?.reactions[0]?.userIds).toEqual([seeded.allowedUserId]);
	});
});
