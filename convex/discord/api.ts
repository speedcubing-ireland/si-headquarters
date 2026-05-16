import { ConvexError, v } from "convex/values";
import {
	action,
	internalMutation,
	mutation,
	query,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { requireUserId } from "../core/auth";
import { requireDirector } from "../core/admin";
import { requireDiscordGuildId } from "./config";
import {
	NOTIFICATION_TYPES,
	notificationType,
} from "../notifications/lib/validators";

const discordLinkReturns = v.union(
	v.object({
		userId: v.id("users"),
		guildId: v.string(),
		discordUserId: v.string(),
		discordUsername: v.string(),
		discordDisplayName: v.optional(v.string()),
		discordAvatarUrl: v.optional(v.string()),
		linkedById: v.id("users"),
		linkedAt: v.number(),
		updatedAt: v.number(),
	}),
	v.null(),
);

const discordNotificationPreferenceReturns = v.object({
	type: notificationType,
	enabled: v.boolean(),
});

const discordSettingsReturns = v.object({
	link: discordLinkReturns,
	dmEnabled: v.boolean(),
	preferences: v.array(discordNotificationPreferenceReturns),
});

const guildChannelSummary = v.object({
	guildId: v.string(),
	id: v.string(),
	name: v.string(),
	type: v.number(),
	position: v.number(),
	parentId: v.optional(v.string()),
});

const guildMemberSummary = v.object({
	discordUserId: v.string(),
	discordUsername: v.string(),
	discordDisplayName: v.optional(v.string()),
	discordAvatarUrl: v.optional(v.string()),
});

const adminLinkedUserReturns = v.object({
	userId: v.id("users"),
	name: v.string(),
	email: v.string(),
	link: discordLinkReturns,
});

function buildPreferenceRows(
	overrides: Map<string, boolean>,
): Array<{ type: (typeof NOTIFICATION_TYPES)[number]; enabled: boolean }> {
	return NOTIFICATION_TYPES.map((type) => ({
		type,
		enabled: overrides.get(type) ?? true,
	}));
}

export const getCurrentUserSettings = query({
	args: {},
	returns: discordSettingsReturns,
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const [link, settings, preferenceDocs] = await Promise.all([
			ctx.db
				.query("discordUserLinks")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.unique(),
			ctx.db
				.query("discordNotificationUserSettings")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.unique(),
			ctx.db
				.query("discordNotificationPreferences")
				.withIndex("by_user_and_type", (q) => q.eq("userId", userId))
				.collect(),
		]);

		const overrides = new Map(
			preferenceDocs.map((doc) => [doc.type, doc.enabled]),
		);
		return {
			link: link ?? null,
			dmEnabled: settings?.dmEnabled ?? true,
			preferences: buildPreferenceRows(overrides),
		};
	},
});

export const setCurrentUserDmEnabled = mutation({
	args: { dmEnabled: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await ctx.db
			.query("discordNotificationUserSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		const updatedAt = Date.now();
		if (existing) {
			await ctx.db.patch("discordNotificationUserSettings", existing._id, {
				dmEnabled: args.dmEnabled,
				updatedAt,
			});
		} else {
			await ctx.db.insert("discordNotificationUserSettings", {
				userId,
				dmEnabled: args.dmEnabled,
				updatedAt,
			});
		}
		return null;
	},
});

export const setCurrentUserTypePreference = mutation({
	args: { type: notificationType, enabled: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await ctx.db
			.query("discordNotificationPreferences")
			.withIndex("by_user_and_type", (q) =>
				q.eq("userId", userId).eq("type", args.type),
			)
			.unique();
		const updatedAt = Date.now();
		if (existing) {
			await ctx.db.patch("discordNotificationPreferences", existing._id, {
				enabled: args.enabled,
				updatedAt,
			});
		} else {
			await ctx.db.insert("discordNotificationPreferences", {
				userId,
				type: args.type,
				enabled: args.enabled,
				updatedAt,
			});
		}
		return null;
	},
});

export const listLinkedUsers = query({
	args: {},
	returns: v.array(adminLinkedUserReturns),
	handler: async (ctx) => {
		await requireDirector(ctx);
		const [users, links] = await Promise.all([
			ctx.db.query("users").withIndex("email").collect(),
			ctx.db.query("discordUserLinks").collect(),
		]);
		const linkByUserId = new Map(links.map((link) => [link.userId, link]));
		return users
			.map((user) => ({
				userId: user._id,
				name: user.name ?? "",
				email: user.email ?? "",
				link: linkByUserId.get(user._id) ?? null,
			}))
			.sort(
				(a, b) =>
					a.name.localeCompare(b.name) || a.email.localeCompare(b.email),
			);
	},
});

export const setUserLink = mutation({
	args: {
		userId: v.id("users"),
		discordUserId: v.string(),
		discordUsername: v.string(),
		discordDisplayName: v.optional(v.string()),
		discordAvatarUrl: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const linkedById = await requireUserId(ctx);
		await requireDirector(ctx);
		const guildId = requireDiscordGuildId();
		const [existingForUser, existingForDiscordUser] = await Promise.all([
			ctx.db
				.query("discordUserLinks")
				.withIndex("by_user", (q) => q.eq("userId", args.userId))
				.unique(),
			ctx.db
				.query("discordUserLinks")
				.withIndex("by_guild_and_discord_user", (q) =>
					q.eq("guildId", guildId).eq("discordUserId", args.discordUserId),
				)
				.unique(),
		]);
		const updatedAt = Date.now();

		if (
			existingForDiscordUser &&
			existingForDiscordUser.userId !== args.userId
		) {
			await ctx.db.delete("discordUserLinks", existingForDiscordUser._id);
		}

		if (existingForUser) {
			await ctx.db.patch("discordUserLinks", existingForUser._id, {
				guildId,
				discordUserId: args.discordUserId,
				discordUsername: args.discordUsername,
				discordDisplayName: args.discordDisplayName,
				discordAvatarUrl: args.discordAvatarUrl,
				linkedById,
				linkedAt: updatedAt,
				updatedAt,
			});
			return null;
		}

		await ctx.db.insert("discordUserLinks", {
			userId: args.userId,
			guildId,
			discordUserId: args.discordUserId,
			discordUsername: args.discordUsername,
			discordDisplayName: args.discordDisplayName,
			discordAvatarUrl: args.discordAvatarUrl,
			linkedById,
			linkedAt: updatedAt,
			updatedAt,
		});
		return null;
	},
});

export const clearUserLink = mutation({
	args: { userId: v.id("users") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const existing = await ctx.db
			.query("discordUserLinks")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.unique();
		if (existing) {
			await ctx.db.delete("discordUserLinks", existing._id);
		}
		return null;
	},
});

export const listGuildChannels = action({
	args: {},
	returns: v.array(guildChannelSummary),
	handler: async (
		ctx,
	): Promise<
		Array<{
			guildId: string;
			id: string;
			name: string;
			type: number;
			position: number;
			parentId?: string;
		}>
	> => {
		const isDirector = await ctx.runQuery(
			internal.core.admin.getIsDirectorInternal,
			{},
		);
		if (!isDirector) {
			throw new ConvexError("Only directors can list Discord channels.");
		}
		return await ctx.runAction(
			internal.discord.actions.listGuildChannelsAction,
			{},
		);
	},
});

export const listGuildMembers = action({
	args: {},
	returns: v.array(guildMemberSummary),
	handler: async (
		ctx,
	): Promise<
		Array<{
			discordUserId: string;
			discordUsername: string;
			discordDisplayName?: string;
			discordAvatarUrl?: string;
		}>
	> => {
		const isDirector = await ctx.runQuery(
			internal.core.admin.getIsDirectorInternal,
			{},
		);
		if (!isDirector) {
			throw new ConvexError("Only directors can list Discord members.");
		}
		return await ctx.runAction(
			internal.discord.actions.listGuildMembersAction,
			{},
		);
	},
});

export const registerSlashCommands = action({
	args: {},
	returns: v.array(
		v.object({
			id: v.string(),
			name: v.string(),
			description: v.string(),
		}),
	),
	handler: async (
		ctx,
	): Promise<Array<{ id: string; name: string; description: string }>> => {
		const isDirector = await ctx.runQuery(
			internal.core.admin.getIsDirectorInternal,
			{},
		);
		if (!isDirector) {
			throw new ConvexError("Only directors can register Discord commands.");
		}
		return await ctx.runAction(
			internal.discord.actions.registerSlashCommandsAction,
			{},
		);
	},
});

export const getLinkedUserByDiscordUserId = query({
	args: { discordUserId: v.string() },
	returns: v.union(
		v.object({
			userId: v.id("users"),
			guildId: v.string(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const link = await ctx.db
			.query("discordUserLinks")
			.withIndex("by_discord_user", (q) =>
				q.eq("discordUserId", args.discordUserId),
			)
			.unique();
		if (!link) {
			return null;
		}
		return {
			userId: link.userId,
			guildId: link.guildId,
		};
	},
});

export const executeActionToken = internalMutation({
	args: {
		token: v.string(),
		discordUserId: v.string(),
	},
	returns: v.object({
		content: v.string(),
		clearMessage: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const [tokenDoc, link] = await Promise.all([
			ctx.db
				.query("discordActionTokens")
				.withIndex("by_token", (q) => q.eq("token", args.token))
				.unique(),
			ctx.db
				.query("discordUserLinks")
				.withIndex("by_discord_user", (q) =>
					q.eq("discordUserId", args.discordUserId),
				)
				.unique(),
		]);

		if (!link) {
			return {
				content: "Your Discord account is not linked to an HQ user.",
				clearMessage: false,
			};
		}
		if (!tokenDoc) {
			return {
				content: "This Discord action token is invalid.",
				clearMessage: false,
			};
		}
		if (tokenDoc.expiresAt < Date.now()) {
			return {
				content: "This Discord action has expired.",
				clearMessage: true,
			};
		}
		if (tokenDoc.consumedAt) {
			return {
				content: "This Discord action has already been used.",
				clearMessage: true,
			};
		}
		if (tokenDoc.userId && tokenDoc.userId !== link.userId) {
			return {
				content: "This Discord action belongs to a different HQ user.",
				clearMessage: false,
			};
		}

		const consumedAt = Date.now();
		let content = "Action completed.";

		switch (tokenDoc.actionKind) {
			case "clear_delivery": {
				if (tokenDoc.deliveryId) {
					await ctx.runMutation(internal.discord.api.markDeliveryCleared, {
						deliveryId: tokenDoc.deliveryId,
					});
				}
				content = "Notification cleared.";
				break;
			}
			case "set_task_status": {
				if (!tokenDoc.taskId || !tokenDoc.status) {
					throw new ConvexError("Task status action token is missing data.");
				}
				await ctx.runMutation(internal.tasks.api.discordSetStatus, {
					taskId: tokenDoc.taskId,
					status: tokenDoc.status,
					actorUserId: link.userId,
				});
				content = `Task moved to ${tokenDoc.status}.`;
				break;
			}
			case "approve_task": {
				if (!tokenDoc.taskId) {
					throw new ConvexError("Approve action token is missing a task.");
				}
				await ctx.runMutation(internal.tasks.api.discordApproveTask, {
					taskId: tokenDoc.taskId,
					actorUserId: link.userId,
				});
				content = "Task approved.";
				break;
			}
			case "unapprove_task": {
				if (!tokenDoc.taskId) {
					throw new ConvexError("Unapprove action token is missing a task.");
				}
				await ctx.runMutation(internal.tasks.api.discordUnapproveTask, {
					taskId: tokenDoc.taskId,
					actorUserId: link.userId,
				});
				content = "Task approval removed.";
				break;
			}
		}

		await ctx.db.patch("discordActionTokens", tokenDoc._id, {
			consumedAt,
		});

		return {
			content,
			clearMessage: true,
		};
	},
});

export const markDeliverySent = internalMutation({
	args: {
		deliveryId: v.id("discordMessageDeliveries"),
		messageId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch("discordMessageDeliveries", args.deliveryId, {
			status: "sent",
			messageId: args.messageId,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const markDeliveryCleared = internalMutation({
	args: {
		deliveryId: v.id("discordMessageDeliveries"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch("discordMessageDeliveries", args.deliveryId, {
			clearedAt: Date.now(),
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const markDeliverySkipped = internalMutation({
	args: {
		deliveryId: v.id("discordMessageDeliveries"),
		reason: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch("discordMessageDeliveries", args.deliveryId, {
			status: "skipped",
			reason: args.reason,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const markDeliveryFailed = internalMutation({
	args: {
		deliveryId: v.id("discordMessageDeliveries"),
		reason: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch("discordMessageDeliveries", args.deliveryId, {
			status: "failed",
			reason: args.reason,
			updatedAt: Date.now(),
		});
		return null;
	},
});
