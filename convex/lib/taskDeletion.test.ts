import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { deleteEntitySubscriptions } from "./taskDeletion";
import schema from "../schema";
import { modules } from "../test.setup";

describe("deleteEntitySubscriptions", () => {
	test("deletes only matching entity subscriptions", async () => {
		const t = convexTest(schema, modules);

		await t.run(async (ctx) => {
			const subscriptionUserId = await ctx.db.insert("users", {});

			await ctx.db.insert("notificationSubscriptions", {
				userId: subscriptionUserId,
				subscriptionType: "entity",
				entityType: "task",
				entityId: "task-1",
				updatedAt: Date.now(),
			});
			await ctx.db.insert("notificationSubscriptions", {
				userId: subscriptionUserId,
				subscriptionType: "entity",
				entityType: "task",
				entityId: "task-2",
				updatedAt: Date.now(),
			});
			await ctx.db.insert("notificationSubscriptions", {
				userId: subscriptionUserId,
				subscriptionType: "entity",
				entityType: "competition",
				entityId: "comp-1",
				updatedAt: Date.now(),
			});
			await ctx.db.insert("notificationSubscriptions", {
				userId: subscriptionUserId,
				subscriptionType: "view",
				viewEntity: "tasks",
				updatedAt: Date.now(),
			});
		});

		await t.run(async (ctx) => {
			await deleteEntitySubscriptions(ctx, "task", ["task-1", "task-1"]);
		});

		const rows = await t.run(async (ctx) =>
			ctx.db.query("notificationSubscriptions").collect(),
		);
		expect(rows).toHaveLength(3);
		expect(
			rows.some(
				(row) =>
					row.subscriptionType === "entity" &&
					row.entityType === "task" &&
					row.entityId === "task-1",
			),
		).toBe(false);
		expect(
			rows.some(
				(row) =>
					row.subscriptionType === "entity" &&
					row.entityType === "task" &&
					row.entityId === "task-2",
			),
		).toBe(true);
		expect(
			rows.some(
				(row) =>
					row.subscriptionType === "entity" &&
					row.entityType === "competition" &&
					row.entityId === "comp-1",
			),
		).toBe(true);
		expect(rows.some((row) => row.subscriptionType === "view")).toBe(true);
	});

	test("returns without changes when no ids are provided", async () => {
		const t = convexTest(schema, modules);

		await t.run(async (ctx) => {
			const subscriptionUserId = await ctx.db.insert("users", {});

			await ctx.db.insert("notificationSubscriptions", {
				userId: subscriptionUserId,
				subscriptionType: "entity",
				entityType: "task",
				entityId: "task-1",
				updatedAt: Date.now(),
			});
		});

		await t.run(async (ctx) => {
			await deleteEntitySubscriptions(ctx, "task", []);
		});

		const rows = await t.run(async (ctx) =>
			ctx.db.query("notificationSubscriptions").collect(),
		);
		expect(rows).toHaveLength(1);
	});
});
