import { ConvexError, v } from "convex/values";
import {
	action,
	internalMutation,
	mutation,
	query,
} from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireUserId } from "../core/auth";
import { requireDirector } from "../core/admin";
import { requireDiscordGuildId } from "./config";
import {
	NOTIFICATION_TYPES,
	CHANNEL_SCOPED_NOTIFICATION_TYPES,
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

function toDiscordLinkReturn(
	link: Doc<"discordUserLinks"> | null | undefined,
): {
	userId: Doc<"discordUserLinks">["userId"];
	guildId: string;
	discordUserId: string;
	discordUsername: string;
	discordDisplayName?: string;
	discordAvatarUrl?: string;
	linkedById: Doc<"discordUserLinks">["linkedById"];
	linkedAt: number;
	updatedAt: number;
} | null {
	if (!link) {
		return null;
	}
	return {
		userId: link.userId,
		guildId: link.guildId,
		discordUserId: link.discordUserId,
		discordUsername: link.discordUsername,
		...(link.discordDisplayName !== undefined && {
			discordDisplayName: link.discordDisplayName,
		}),
		...(link.discordAvatarUrl !== undefined && {
			discordAvatarUrl: link.discordAvatarUrl,
		}),
		linkedById: link.linkedById,
		linkedAt: link.linkedAt,
		updatedAt: link.updatedAt,
	};
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
			link: toDiscordLinkReturn(link),
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
				link: toDiscordLinkReturn(linkByUserId.get(user._id)),
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
			await ctx.db.patch("users", existingForDiscordUser.userId, {
				discordAvatarUrl: "",
			});
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
			await ctx.db.patch("users", args.userId, {
				discordAvatarUrl: args.discordAvatarUrl ?? "",
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
		await ctx.db.patch("users", args.userId, {
			discordAvatarUrl: args.discordAvatarUrl ?? "",
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
		await ctx.db.patch("users", args.userId, {
			discordAvatarUrl: "",
		});
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
	returns: v.union(
		v.object({
			kind: v.literal("message"),
			content: v.string(),
			clearMessage: v.boolean(),
			isDismiss: v.boolean(),
		}),
		v.object({
			kind: v.literal("modal"),
			title: v.string(),
			label: v.string(),
			placeholder: v.optional(v.string()),
		}),
	),
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
				kind: "message" as const,
				content: "Your Discord account is not linked to an HQ user.",
				clearMessage: false,
				isDismiss: false,
			};
		}
		if (!tokenDoc) {
			return {
				kind: "message" as const,
				content: "This Discord action token is invalid.",
				clearMessage: false,
				isDismiss: false,
			};
		}
		if (tokenDoc.expiresAt < Date.now()) {
			return {
				kind: "message" as const,
				content: "This Discord action has expired.",
				clearMessage: true,
				isDismiss: false,
			};
		}
		if (tokenDoc.consumedAt) {
			return {
				kind: "message" as const,
				content: "This Discord action has already been used.",
				clearMessage: true,
				isDismiss: false,
			};
		}
		if (tokenDoc.userId && tokenDoc.userId !== link.userId) {
			return {
				kind: "message" as const,
				content: "This Discord action belongs to a different HQ user.",
				clearMessage: false,
				isDismiss: false,
			};
		}

		switch (tokenDoc.actionKind) {
			case "dismiss_message": {
				await ctx.db.patch("discordActionTokens", tokenDoc._id, {
					consumedAt: Date.now(),
				});
				return {
					kind: "message" as const,
					content: "Notification dismissed.",
					clearMessage: true,
					isDismiss: true,
				};
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
				await ctx.db.patch("discordActionTokens", tokenDoc._id, {
					consumedAt: Date.now(),
				});
				return {
					kind: "message" as const,
					content: `Task moved to ${tokenDoc.status}.`,
					clearMessage: true,
					isDismiss: false,
				};
			}
			case "approve_task": {
				if (!tokenDoc.taskId) {
					throw new ConvexError("Approve action token is missing a task.");
				}
				await ctx.runMutation(internal.tasks.api.discordApproveTask, {
					taskId: tokenDoc.taskId,
					actorUserId: link.userId,
				});
				await ctx.db.patch("discordActionTokens", tokenDoc._id, {
					consumedAt: Date.now(),
				});
				return {
					kind: "message" as const,
					content: "Task approved.",
					clearMessage: true,
					isDismiss: false,
				};
			}
			case "unapprove_task": {
				if (!tokenDoc.taskId) {
					throw new ConvexError("Unapprove action token is missing a task.");
				}
				await ctx.runMutation(internal.tasks.api.discordUnapproveTask, {
					taskId: tokenDoc.taskId,
					actorUserId: link.userId,
				});
				await ctx.db.patch("discordActionTokens", tokenDoc._id, {
					consumedAt: Date.now(),
				});
				return {
					kind: "message" as const,
					content: "Task approval removed.",
					clearMessage: true,
					isDismiss: false,
				};
			}
			case "open_task_comment_modal":
			case "open_task_reply_modal":
			case "open_update_comment_modal": {
				return {
					kind: "modal" as const,
					title:
						tokenDoc.actionKind === "open_task_reply_modal"
							? "Reply in Headquarters"
							: "Comment in Headquarters",
					label:
						tokenDoc.actionKind === "open_task_reply_modal"
							? "Reply"
							: "Comment",
					placeholder:
						tokenDoc.actionKind === "open_update_comment_modal"
							? "Add a progress update comment"
							: "Write your comment",
				};
			}
		}
	},
});

export const submitActionModal = internalMutation({
	args: {
		token: v.string(),
		discordUserId: v.string(),
		content: v.string(),
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

		switch (tokenDoc.actionKind) {
			case "open_task_comment_modal": {
				if (!tokenDoc.taskId) {
					throw new ConvexError("Comment action token is missing a task.");
				}
				await ctx.runMutation(internal.comments.api.discordCreateComment, {
					actorUserId: link.userId,
					parentType: "task",
					parentId: `${tokenDoc.taskId}`,
					content: args.content,
				});
				break;
			}
			case "open_task_reply_modal": {
				if (!tokenDoc.taskId || !tokenDoc.commentId) {
					throw new ConvexError("Reply action token is missing comment data.");
				}
				await ctx.runMutation(internal.comments.api.discordCreateComment, {
					actorUserId: link.userId,
					parentType: "task",
					parentId: `${tokenDoc.taskId}`,
					parentCommentId: tokenDoc.commentId,
					content: args.content,
				});
				break;
			}
			case "open_update_comment_modal": {
				if (!tokenDoc.updateId) {
					throw new ConvexError("Update comment token is missing an update.");
				}
				await ctx.runMutation(internal.comments.api.discordCreateComment, {
					actorUserId: link.userId,
					parentType: "update",
					parentId: `${tokenDoc.updateId}`,
					content: args.content,
				});
				break;
			}
			default:
				throw new ConvexError("This Discord action does not accept a modal.");
		}

		await ctx.db.patch("discordActionTokens", tokenDoc._id, {
			consumedAt: Date.now(),
		});
		return {
			content: "Comment posted.",
			clearMessage: false,
		};
	},
});

const channelDefaultsReturns = v.object({
	notificationTypes: v.array(notificationType),
	updatedAt: v.number(),
});

export const getChannelDefaults = query({
	args: {},
	returns: channelDefaultsReturns,
	handler: async (ctx) => {
		await requireDirector(ctx);
		const defaults = await ctx.db.query("discordChannelDefaults").first();
		if (!defaults) {
			return {
				notificationTypes: [...CHANNEL_SCOPED_NOTIFICATION_TYPES],
				updatedAt: 0,
			};
		}
		return {
			notificationTypes: defaults.notificationTypes,
			updatedAt: defaults.updatedAt,
		};
	},
});

export const setChannelDefaults = mutation({
	args: {
		notificationTypes: v.array(notificationType),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const existing = await ctx.db.query("discordChannelDefaults").first();
		const now = Date.now();
		if (existing) {
			await ctx.db.patch("discordChannelDefaults", existing._id, {
				notificationTypes: args.notificationTypes,
				updatedAt: now,
			});
		} else {
			await ctx.db.insert("discordChannelDefaults", {
				notificationTypes: args.notificationTypes,
				updatedAt: now,
			});
		}
		return null;
	},
});

const competitionChannelSummary = v.object({
	competitionId: v.id("competitions"),
	competitionName: v.string(),
	compStart: v.string(),
	compEnd: v.string(),
	guildId: v.string(),
	channelId: v.string(),
	channelName: v.string(),
	usesGlobalDefaults: v.boolean(),
	notificationTypeOverrides: v.array(notificationType),
});

export const listCompetitionChannels = query({
	args: {},
	returns: v.array(competitionChannelSummary),
	handler: async (ctx) => {
		await requireDirector(ctx);
		const competitions = await ctx.db
			.query("competitions")
			.withIndex("by_comp_start")
			.order("asc")
			.collect();
		return competitions
			.filter(
				(
					comp,
				): comp is Doc<"competitions"> & {
					discordChannel: NonNullable<Doc<"competitions">["discordChannel"]>;
				} => comp.discordChannel !== undefined,
			)
			.map((comp) => {
				const dc = comp.discordChannel;
				return {
					competitionId: comp._id,
					competitionName: comp.name,
					compStart: comp.compStart,
					compEnd: comp.compEnd,
					guildId: dc.guildId,
					channelId: dc.channelId,
					channelName: dc.channelName,
					usesGlobalDefaults: dc.notificationTypeOverrides === undefined,
					notificationTypeOverrides: dc.notificationTypeOverrides ?? [],
				};
			});
	},
});

export const setCompetitionChannelOverrides = mutation({
	args: {
		competitionId: v.id("competitions"),
		notificationTypeOverrides: v.array(notificationType),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const competition = await ctx.db.get("competitions", args.competitionId);
		if (!competition?.discordChannel) {
			throw new ConvexError(
				"Competition does not have a linked Discord channel.",
			);
		}
		await ctx.db.patch("competitions", args.competitionId, {
			discordChannel: {
				...competition.discordChannel,
				notificationTypeOverrides:
					args.notificationTypeOverrides.length > 0
						? args.notificationTypeOverrides
						: undefined,
			},
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const removeCompetitionChannel = mutation({
	args: {
		competitionId: v.id("competitions"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const competition = await ctx.db.get("competitions", args.competitionId);
		if (!competition) {
			throw new ConvexError("Competition not found.");
		}
		await ctx.db.patch("competitions", args.competitionId, {
			discordChannel: undefined,
			updatedAt: Date.now(),
		});
		return null;
	},
});
