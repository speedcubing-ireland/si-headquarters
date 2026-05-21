import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

describe("return validation smoke coverage", () => {
	test("notification subscriptions query returns updatedAt fields", async () => {
		const t = convexTest(schema, modules);
		const { userId, taskId } = await t.run(async (ctx) => {
			const nextUserId = await ctx.db.insert("users", {
				email: "settings@example.com",
			});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Returns comp",
				description: "",
				compStart: "2026-01-01",
				compEnd: "2026-01-02",
				organiserIds: [nextUserId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: nextUserId,
			});
			const nextTaskId = await ctx.db.insert("tasks", {
				identifier: "HQ-RET",
				title: "Return validation task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			return { userId: nextUserId, taskId: nextTaskId };
		});
		const authed = t.withIdentity({ subject: userId });

		const subscriptionId = await authed.mutation(
			api.notifications.subscriptions.subscribeToEntity,
			{
				entity: { entityType: "task", entityId: taskId },
			},
		);
		const subscriptions = await authed.query(
			api.notifications.subscriptions.listSubscriptions,
			{},
		);

		expect(subscriptionId).toBeTruthy();
		expect(typeof subscriptions[0]?.updatedAt).toBe("string");
	});

	test("users.listUsers returns app user shape", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) =>
			ctx.db.insert("users", {
				name: "Alice",
				email: "alice@example.com",
			}),
		);
		const authed = t.withIdentity({ subject: userId });

		const users = await authed.query(api.core.users.listUsers, {});
		expect(users.length).toBeGreaterThan(0);
		expect(typeof users[0]?.id).toBe("string");
		expect(typeof users[0]?.name).toBe("string");
		expect(typeof users[0]?.avatarUrl).toBe("string");
	});

	test("views.listViews returns mapped saved-view shape", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) =>
			ctx.db.insert("users", { email: "views@example.com" }),
		);
		await t.run(async (ctx) => {
			const now = Date.now();
			await ctx.db.insert("savedViews", {
				userId,
				name: "My View",
				description: "desc",
				entity: "tasks",
				pageId: "tasks-page",
				filtersJson: "{}",
				displaySettingsJson: "{}",
				createdAt: now,
				updatedAt: now,
				lastUsedAt: now,
			});
		});
		const authed = t.withIdentity({ subject: userId });

		const views = await authed.query(api.core.views.listViews, {
			entity: "tasks",
			pageId: "tasks-page",
		});
		expect(views).toHaveLength(1);
		expect(typeof views[0]?.id).toBe("string");
		expect(views[0]?.name).toBe("My View");
		expect(typeof views[0]?.createdAt).toBe("number");
		expect(typeof views[0]?.updatedAt).toBe("number");
	});

	test("sheets preflight returns non-volunteer response shape", async () => {
		const t = convexTest(schema, modules);

		const preflight = await t.query(
			internal.integrations.google.sheetsQueries.getScheduleFetchPreflight,
			{
				sheetId: "sheet-1",
				includeCache: true,
				minFetchedAt: Date.now() - 1000,
			},
		);
		expect(preflight.isVolunteer).toBe(false);
		expect(preflight.isAllowedSheet).toBe(false);
		expect(preflight.cached).toBeNull();
	});

	test("sheets preflight returns cached payload shape for volunteer linked sheet", async () => {
		const t = convexTest(schema, modules);
		const volunteerId = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				email: "volunteer@example.com",
			});
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.VOLUNTEER,
				memberIds: [userId],
			});
			await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2026-01-01",
				compEnd: "2026-01-02",
				organiserIds: [userId],
				compSheet: { type: "google-sheet", sheetId: "sheet-linked" },
				updatedAt: Date.now(),
			});
			await ctx.db.insert("sheetScheduleCache", {
				sheetId: "sheet-linked",
				events: [{ eventName: "3x3 Round 1", rounds: "R1" }],
				fetchedAt: Date.now(),
			});
			return userId;
		});
		const authed = t.withIdentity({ subject: volunteerId });

		const preflight = await authed.query(
			internal.integrations.google.sheetsQueries.getScheduleFetchPreflight,
			{
				sheetId: "sheet-linked",
				includeCache: true,
				minFetchedAt: Date.now() - 60_000,
			},
		);
		expect(preflight.isVolunteer).toBe(true);
		expect(preflight.isAllowedSheet).toBe(true);
		expect(preflight.cached).not.toBeNull();
		expect(typeof preflight.cached?.fetchedAt).toBe("number");
		expect(preflight.cached?.events[0]?.eventName).toBe("3x3 Round 1");
	});
});
