import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedCompetitionWithDiscordChannel(
	t: ReturnType<typeof convexTest>,
	options?: {
		notificationTypeOverrides?: string[];
	},
): Promise<{
	actorId: Id<"users">;
	competitionId: Id<"competitions">;
	channelId: string;
}> {
	return t.run(async (ctx) => {
		const actorId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [actorId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Discord Channel Test Comp",
			description: "",
			compStart: "2026-06-01",
			compEnd: "2026-06-02",
			organiserIds: [actorId],
			discordChannel: {
				guildId: "guild-1",
				channelId: "channel-123",
				channelName: "test-comp",
				notificationTypeOverrides: options?.notificationTypeOverrides,
			},
			updatedAt: Date.now(),
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId: actorId,
		});
		return { actorId, competitionId, channelId: "channel-123" };
	});
}

describe("competition channel admin API", () => {
	test("listCompetitionChannels returns channels for competitions with linked Discord", async () => {
		const t = convexTest(schema, modules);
		const { competitionId } = await seedCompetitionWithDiscordChannel(t);
		const directorId = await t.run(async (ctx) => ctx.db.insert("users", {}));
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.DIRECTORS,
				memberIds: [directorId],
			});
		});
		const authed = t.withIdentity({ subject: directorId });

		const channels = await authed.query(
			api.discord.api.listCompetitionChannels,
			{},
		);

		expect(channels.length).toBe(1);
		expect(channels[0].competitionId).toBe(competitionId);
		expect(channels[0].channelName).toBe("test-comp");
		expect(channels[0].competitionName).toBe("Discord Channel Test Comp");
	}, 15_000);

	test("listCompetitionChannels excludes competitions without linked channels", async () => {
		const t = convexTest(schema, modules);
		await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.VOLUNTEER,
				memberIds: [userId],
			});
			await ctx.db.insert("competitions", {
				name: "No Channel Comp",
				description: "",
				compStart: "2026-06-01",
				compEnd: "2026-06-02",
				organiserIds: [userId],
				updatedAt: Date.now(),
			});
		});
		const directorId = await t.run(async (ctx) => ctx.db.insert("users", {}));
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.DIRECTORS,
				memberIds: [directorId],
			});
		});
		const authed = t.withIdentity({ subject: directorId });

		const channels = await authed.query(
			api.discord.api.listCompetitionChannels,
			{},
		);

		expect(channels.length).toBe(0);
	}, 15_000);

	test("listCompetitionChannels defaults to all channel-scoped types when not configured", async () => {
		const t = convexTest(schema, modules);
		await seedCompetitionWithDiscordChannel(t, {
			notificationTypeOverrides: undefined,
		});
		const directorId = await t.run(async (ctx) => ctx.db.insert("users", {}));
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.DIRECTORS,
				memberIds: [directorId],
			});
		});
		const authed = t.withIdentity({ subject: directorId });

		const channels = await authed.query(
			api.discord.api.listCompetitionChannels,
			{},
		);

		expect(channels.length).toBe(1);
		expect(channels[0].usesGlobalDefaults).toBe(true);
		expect(channels[0].notificationTypeOverrides).toEqual([]);
	}, 15_000);

	test("setCompetitionChannelOverrides updates notification types", async () => {
		const t = convexTest(schema, modules);
		const { competitionId } = await seedCompetitionWithDiscordChannel(t);
		const directorId = await t.run(async (ctx) => ctx.db.insert("users", {}));
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.DIRECTORS,
				memberIds: [directorId],
			});
		});
		const authed = t.withIdentity({ subject: directorId });

		await authed.mutation(api.discord.api.setCompetitionChannelOverrides, {
			competitionId,
			notificationTypeOverrides: ["task_assigned", "task_status_changed"],
		});

		const channels = await authed.query(
			api.discord.api.listCompetitionChannels,
			{},
		);

		expect(channels[0].usesGlobalDefaults).toBe(false);
		expect(channels[0].notificationTypeOverrides).toContain("task_assigned");
		expect(channels[0].notificationTypeOverrides).toContain(
			"task_status_changed",
		);
		expect(channels[0].notificationTypeOverrides).not.toContain(
			"task_priority_changed",
		);
	}, 15_000);

	test("setCompetitionChannelOverrides can explicitly disable all channel notifications", async () => {
		const t = convexTest(schema, modules);
		const { competitionId } = await seedCompetitionWithDiscordChannel(t);
		const directorId = await t.run(async (ctx) => ctx.db.insert("users", {}));
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.DIRECTORS,
				memberIds: [directorId],
			});
		});
		const authed = t.withIdentity({ subject: directorId });

		await authed.mutation(api.discord.api.setCompetitionChannelOverrides, {
			competitionId,
			notificationTypeOverrides: [],
		});

		const channels = await authed.query(
			api.discord.api.listCompetitionChannels,
			{},
		);

		expect(channels[0].usesGlobalDefaults).toBe(false);
		expect(channels[0].notificationTypeOverrides).toEqual([]);
	}, 15_000);

	test("setCompetitionChannelOverrides can reset to watcher defaults", async () => {
		const t = convexTest(schema, modules);
		const { competitionId } = await seedCompetitionWithDiscordChannel(t);
		const directorId = await t.run(async (ctx) => ctx.db.insert("users", {}));
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.DIRECTORS,
				memberIds: [directorId],
			});
		});
		const authed = t.withIdentity({ subject: directorId });

		await authed.mutation(api.discord.api.setCompetitionChannelOverrides, {
			competitionId,
			notificationTypeOverrides: [],
			useGlobalDefaults: true,
		});

		const channels = await authed.query(
			api.discord.api.listCompetitionChannels,
			{},
		);

		expect(channels[0].usesGlobalDefaults).toBe(true);
	}, 15_000);

	test("listWatcherDefaults returns quiet channel defaults and task watcher defaults", async () => {
		const t = convexTest(schema, modules);
		await seedCompetitionWithDiscordChannel(t);
		const directorId = await t.run(async (ctx) => ctx.db.insert("users", {}));
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.DIRECTORS,
				memberIds: [directorId],
			});
		});
		const authed = t.withIdentity({ subject: directorId });

		const defaults = await authed.query(
			api.discord.api.listWatcherDefaults,
			{},
		);
		const channel = defaults.find((row) => row.level === "channel");
		const task = defaults.find((row) => row.level === "task");

		expect(channel?.notificationTypes).toContain("progress_update_added");
		expect(channel?.notificationTypes).not.toContain("task_assigned");
		expect(channel?.notificationTypes).not.toContain("relation_blocked");
		expect(task?.notificationTypes).toContain("task_assigned");
		expect(task?.notificationTypes).toContain("due_date_overdue");
		expect(task?.notificationTypes).not.toContain("task_mentioned");
	}, 15_000);

	test("removeCompetitionChannel removes the discord channel link", async () => {
		const t = convexTest(schema, modules);
		const { competitionId } = await seedCompetitionWithDiscordChannel(t);
		const directorId = await t.run(async (ctx) => ctx.db.insert("users", {}));
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.DIRECTORS,
				memberIds: [directorId],
			});
		});
		const authed = t.withIdentity({ subject: directorId });

		await authed.mutation(api.discord.api.removeCompetitionChannel, {
			competitionId,
		});

		const channels = await authed.query(
			api.discord.api.listCompetitionChannels,
			{},
		);

		expect(channels.length).toBe(0);

		const comp = await authed.query(api.competitions.api.get, {
			competitionId,
		});
		expect(comp?.discordChannel).toBeUndefined();
	}, 15_000);

	test("non-director cannot access listCompetitionChannels", async () => {
		const t = convexTest(schema, modules);
		await seedCompetitionWithDiscordChannel(t);
		const regularUserId = await t.run(async (ctx) =>
			ctx.db.insert("users", {}),
		);
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.VOLUNTEER,
				memberIds: [regularUserId],
			});
		});
		const authed = t.withIdentity({ subject: regularUserId });

		await expect(
			authed.query(api.discord.api.listCompetitionChannels, {}),
		).rejects.toThrow();
	}, 15_000);

	test("non-director cannot update competition channel overrides", async () => {
		const t = convexTest(schema, modules);
		const { competitionId } = await seedCompetitionWithDiscordChannel(t);
		const regularUserId = await t.run(async (ctx) =>
			ctx.db.insert("users", {}),
		);
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.VOLUNTEER,
				memberIds: [regularUserId],
			});
		});
		const authed = t.withIdentity({ subject: regularUserId });

		await expect(
			authed.mutation(api.discord.api.setCompetitionChannelOverrides, {
				competitionId,
				notificationTypeOverrides: ["task_assigned"],
			}),
		).rejects.toThrow();
	}, 15_000);
});
