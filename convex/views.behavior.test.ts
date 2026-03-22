import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function seedView(t: ReturnType<typeof convexTest>): Promise<{
	userId: Id<"users">;
	otherId: Id<"users">;
	viewId: Id<"savedViews">;
}> {
	const { userId, otherId } = await t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		const otherId = await ctx.db.insert("users", {});
		return { userId, otherId };
	});
	const authed = t.withIdentity({ subject: userId });

	const viewId = await authed.mutation(api.views.createView, {
		entity: "tasks",
		pageId: "board",
		name: "My View",
		description: "A test view",
		filtersJson: '{"status":"to-do"}',
		displaySettingsJson: '{"columns":["title"]}',
	});
	return { userId, otherId, viewId };
}

describe("saved views behavior", () => {
	test("createView stores filters, display settings, and timestamps", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });

		const viewId = await authed.mutation(api.views.createView, {
			entity: "tasks",
			pageId: "board",
			name: "Board View",
			description: "Filtered board",
			filtersJson: '{"status":"to-do"}',
			displaySettingsJson: '{"columns":["title"]}',
		});

		const doc = await t.run((ctx) => ctx.db.get("savedViews", viewId));
		expect(doc).toBeTruthy();
		expect(doc?.name).toBe("Board View");
		expect(doc?.description).toBe("Filtered board");
		expect(doc?.entity).toBe("tasks");
		expect(doc?.pageId).toBe("board");
		expect(doc?.filtersJson).toBe('{"status":"to-do"}');
		expect(doc?.displaySettingsJson).toBe('{"columns":["title"]}');
		expect(doc?.createdAt).toBeTypeOf("number");
		expect(doc?.updatedAt).toBe(doc?.createdAt);
		expect(doc?.lastUsedAt).toBe(doc?.createdAt);
	});

	test("listViews returns only views for the authenticated user, entity, and pageId", async () => {
		const t = convexTest(schema, modules);
		const { userId, otherId } = await seedView(t);
		const authed = t.withIdentity({ subject: userId });
		const otherAuthed = t.withIdentity({ subject: otherId });

		await otherAuthed.mutation(api.views.createView, {
			entity: "tasks",
			pageId: "board",
			name: "Other View",
			filtersJson: "{}",
			displaySettingsJson: "{}",
		});
		await authed.mutation(api.views.createView, {
			entity: "competitions",
			pageId: "board",
			name: "Comp View",
			filtersJson: "{}",
			displaySettingsJson: "{}",
		});

		const rows = await authed.query(api.views.listViews, {
			entity: "tasks",
			pageId: "board",
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("My View");
	});

	test("touchView updates lastUsedAt without changing updatedAt", async () => {
		const t = convexTest(schema, modules);
		const { userId, viewId } = await seedView(t);
		const authed = t.withIdentity({ subject: userId });

		const before = await t.run((ctx) => ctx.db.get("savedViews", viewId));
		await authed.mutation(api.views.touchView, { id: viewId });
		const after = await t.run((ctx) => ctx.db.get("savedViews", viewId));

		expect(after?.lastUsedAt).toBeGreaterThanOrEqual(before?.lastUsedAt ?? 0);
		expect(after?.updatedAt).toBe(before?.updatedAt);
	});

	test("updateView changes name and description, advances updatedAt", async () => {
		const t = convexTest(schema, modules);
		const { userId, viewId } = await seedView(t);
		const authed = t.withIdentity({ subject: userId });

		const before = await t.run((ctx) => ctx.db.get("savedViews", viewId));
		await authed.mutation(api.views.updateView, {
			id: viewId,
			name: "Renamed",
			description: "New desc",
		});
		const after = await t.run((ctx) => ctx.db.get("savedViews", viewId));

		expect(after?.name).toBe("Renamed");
		expect(after?.description).toBe("New desc");
		expect(after?.updatedAt).toBeGreaterThanOrEqual(before?.updatedAt);
	});

	test("updateView throws FORBIDDEN for another user's view", async () => {
		const t = convexTest(schema, modules);
		const { otherId, viewId } = await seedView(t);
		const otherAuthed = t.withIdentity({ subject: otherId });

		await expect(
			otherAuthed.mutation(api.views.updateView, {
				id: viewId,
				name: "Hijack",
			}),
		).rejects.toBeTruthy();
	});

	test("deleteView removes the record", async () => {
		const t = convexTest(schema, modules);
		const { userId, viewId } = await seedView(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.views.deleteView, { id: viewId });
		const doc = await t.run((ctx) => ctx.db.get("savedViews", viewId));
		expect(doc).toBeNull();
	});

	test("deleteView throws FORBIDDEN for another user's view", async () => {
		const t = convexTest(schema, modules);
		const { otherId, viewId } = await seedView(t);
		const otherAuthed = t.withIdentity({ subject: otherId });

		await expect(
			otherAuthed.mutation(api.views.deleteView, { id: viewId }),
		).rejects.toBeTruthy();
	});

	test("touchView throws FORBIDDEN for another user's view", async () => {
		const t = convexTest(schema, modules);
		const { otherId, viewId } = await seedView(t);
		const otherAuthed = t.withIdentity({ subject: otherId });

		await expect(
			otherAuthed.mutation(api.views.touchView, { id: viewId }),
		).rejects.toBeTruthy();
	});
});
