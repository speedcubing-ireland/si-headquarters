import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedUser(
	t: ReturnType<typeof convexTest>,
): Promise<Id<"users">> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [userId],
		});
		return userId;
	});
}

describe("notification preferences behavior", () => {
	test("upsertPreference creates a preference record", async () => {
		const t = convexTest(schema, modules);
		const userId = await seedUser(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.notifications.settings.upsertPreference, {
			type: "task_assigned",
			channel: "email",
			enabled: false,
		});

		const prefs = await t.run((ctx) =>
			ctx.db.query("notificationPreferences").collect(),
		);
		const pref = prefs.find(
			(p) =>
				p.userId === userId &&
				p.type === "task_assigned" &&
				p.channel === "email",
		);
		expect(pref).toBeTruthy();
		expect(pref?.enabled).toBe(false);
	});

	test("upsertPreference updates existing preference", async () => {
		const t = convexTest(schema, modules);
		const userId = await seedUser(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.notifications.settings.upsertPreference, {
			type: "comment_added",
			channel: "email",
			enabled: true,
			digestMode: "daily",
		});

		await authed.mutation(api.notifications.settings.upsertPreference, {
			type: "comment_added",
			channel: "email",
			digestMode: "hourly",
		});

		const prefs = await t.run((ctx) =>
			ctx.db.query("notificationPreferences").collect(),
		);
		const matching = prefs.filter(
			(p) =>
				p.userId === userId &&
				p.type === "comment_added" &&
				p.channel === "email",
		);
		expect(matching).toHaveLength(1);
		expect(matching[0]?.digestMode).toBe("hourly");
	});

	test("upsertPreference with clearOverride removes the preference", async () => {
		const t = convexTest(schema, modules);
		const userId = await seedUser(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.notifications.settings.upsertPreference, {
			type: "task_status_changed",
			channel: "email",
			enabled: false,
		});

		await authed.mutation(api.notifications.settings.upsertPreference, {
			type: "task_status_changed",
			channel: "email",
			clearOverride: true,
		});

		const prefs = await t.run((ctx) =>
			ctx.db.query("notificationPreferences").collect(),
		);
		const pref = prefs.find(
			(p) =>
				p.userId === userId &&
				p.type === "task_status_changed" &&
				p.channel === "email",
		);
		expect(pref).toBeUndefined();
	});

	test("upsertUserSettings with quiet hours stores start and end", async () => {
		const t = convexTest(schema, modules);
		const userId = await seedUser(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.notifications.settings.upsertUserSettings, {
			timezone: "Europe/Dublin",
			quietHoursStartMin: 1380, // 23:00
			quietHoursEndMin: 420, // 07:00
		});

		const settings = await authed.query(
			api.notifications.settings.getUserSettings,
			{},
		);
		expect(settings?.timezone).toBe("Europe/Dublin");
		expect(settings?.quietHoursStartMin).toBe(1380);
		expect(settings?.quietHoursEndMin).toBe(420);
	});

	test("upsertUserSettings clearQuietHours removes quiet hours", async () => {
		const t = convexTest(schema, modules);
		const userId = await seedUser(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.notifications.settings.upsertUserSettings, {
			quietHoursStartMin: 1380,
			quietHoursEndMin: 420,
		});

		await authed.mutation(api.notifications.settings.upsertUserSettings, {
			clearQuietHours: true,
		});

		const settings = await authed.query(
			api.notifications.settings.getUserSettings,
			{},
		);
		expect(settings?.quietHoursStartMin).toBeUndefined();
		expect(settings?.quietHoursEndMin).toBeUndefined();
	});
});
