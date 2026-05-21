"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import {
	ComponentType,
	type RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import {
	getDiscordRest,
	listGuildChannels,
	listGuildMembers,
	sendDirectMessage,
	sendChannelMessage,
	deleteChannelMessage,
} from "./client";
import {
	listGuildSlashCommands,
	registerGuildSlashCommands,
} from "./slashCommands";
import { buildCompetitionCountMessage } from "./interactions";
import { requireDiscordDmUserId, requireDiscordGuildId } from "./config";

const discordChannelSummary = v.object({
	guildId: v.string(),
	id: v.string(),
	name: v.string(),
	type: v.number(),
	position: v.number(),
	parentId: v.optional(v.string()),
});

const slashCommandSummary = v.object({
	id: v.string(),
	name: v.string(),
	description: v.string(),
});

const guildMemberSummary = v.object({
	discordUserId: v.string(),
	discordUsername: v.string(),
	discordDisplayName: v.optional(v.string()),
	discordAvatarUrl: v.optional(v.string()),
});

/** Run from the Convex dashboard to list channels in DISCORD_GUILD_ID. */
export const listGuildChannelsAction = internalAction({
	args: {},
	returns: v.array(discordChannelSummary),
	handler: async () => {
		const rest = getDiscordRest();
		const guildId = requireDiscordGuildId();

		const channels = await listGuildChannels(rest, guildId);

		return channels
			.map((channel) => ({
				guildId,
				id: channel.id,
				name: channel.name ?? "",
				type: channel.type,
				position: "position" in channel ? (channel.position ?? 0) : 0,
				parentId:
					"parent_id" in channel ? (channel.parent_id ?? undefined) : undefined,
			}))
			.sort((a, b) => a.position - b.position);
	},
});

/** Run from the Convex dashboard or CLI to send a DM to a user. */
export const sendDmAction = internalAction({
	args: {
		userId: v.string(),
		message: v.string(),
	},
	returns: v.object({
		messageId: v.string(),
		channelId: v.string(),
	}),
	handler: async (_ctx, { userId, message }) => {
		const rest = getDiscordRest();
		const result = await sendDirectMessage(rest, userId, { content: message });
		return {
			messageId: result.id,
			channelId: result.channel_id,
		};
	},
});

/** Send the interactive HQ DM used by the Discord HTTP integration. */
export const sendCompetitionSummaryDmAction = internalAction({
	args: {
		userId: v.optional(v.string()),
	},
	returns: v.object({
		messageId: v.string(),
		channelId: v.string(),
	}),
	handler: async (_ctx, { userId }) => {
		const rest = getDiscordRest();
		const recipientId = userId ?? requireDiscordDmUserId();
		const result = await sendDirectMessage(
			rest,
			recipientId,
			buildCompetitionCountMessage(),
		);
		return {
			messageId: result.id,
			channelId: result.channel_id,
		};
	},
});

export const deleteDiscordMessageAction = internalAction({
	args: {
		channelId: v.string(),
		messageId: v.string(),
	},
	returns: v.null(),
	handler: async (_ctx, { channelId, messageId }) => {
		const rest = getDiscordRest();
		await deleteChannelMessage(rest, channelId, messageId);
		return null;
	},
});

export const listGuildMembersAction = internalAction({
	args: {},
	returns: v.array(guildMemberSummary),
	handler: async () => {
		const rest = getDiscordRest();
		const guildId = requireDiscordGuildId();
		const members = await listGuildMembers(rest, guildId);
		return members
			.filter((member) => !member.user?.bot)
			.map((member) => ({
				discordUserId: member.user.id,
				discordUsername: member.user.username,
				discordDisplayName: member.nick ?? member.user.global_name ?? undefined,
				discordAvatarUrl: member.user.avatar
					? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
					: undefined,
			}))
			.sort((a, b) =>
				(a.discordDisplayName ?? a.discordUsername).localeCompare(
					b.discordDisplayName ?? b.discordUsername,
				),
			);
	},
});

export const sendNotificationMessageAction = internalAction({
	args: {
		destinationKind: v.union(v.literal("dm"), v.literal("channel")),
		targetId: v.string(),
		title: v.string(),
		message: v.string(),
		description: v.optional(v.string()),
		url: v.optional(v.string()),
		priority: v.optional(
			v.union(v.literal("urgent"), v.literal("high"), v.literal("normal")),
		),
		fields: v.optional(
			v.array(
				v.object({
					name: v.string(),
					value: v.string(),
					inline: v.optional(v.boolean()),
				}),
			),
		),
		author: v.optional(
			v.object({
				name: v.string(),
				iconUrl: v.optional(v.string()),
			}),
		),
		actions: v.array(
			v.object({
				customId: v.string(),
				label: v.string(),
				style: v.union(
					v.literal(1),
					v.literal(2),
					v.literal(3),
					v.literal(4),
					v.literal(5),
				),
				url: v.optional(v.string()),
			}),
		),
	},
	returns: v.object({
		messageId: v.string(),
		channelId: v.string(),
	}),
	handler: async (_ctx, args) => {
		const rest = getDiscordRest();
		const description =
			args.description ??
			(args.fields && args.fields.length > 0 ? undefined : args.message);
		const color = (() => {
			switch (args.priority) {
				case "urgent":
					return 0xdc2626; // red-600
				case "high":
					return 0xea580c; // orange-600
				default:
					return 0x2563eb; // blue-600
			}
		})();
		const body: RESTPostAPIChannelMessageJSONBody = {
			embeds: [
				{
					title: args.title,
					description,
					url: args.url,
					color,
					fields: args.fields,
					author: args.author
						? {
								name: args.author.name,
								icon_url: args.author.iconUrl,
							}
						: undefined,
				},
			],
			components: buildNotificationComponents(args.actions),
		};
		const result =
			args.destinationKind === "dm"
				? await sendDirectMessage(rest, args.targetId, body)
				: await sendChannelMessage(rest, args.targetId, body);
		return {
			messageId: result.id,
			channelId: result.channel_id,
		};
	},
});

function buildNotificationComponents(
	actions: Array<{
		customId: string;
		label: string;
		style: 1 | 2 | 3 | 4 | 5;
		url?: string;
	}>,
) {
	const buttons: Array<{
		type: ComponentType.Button;
		style: number;
		label: string;
		custom_id?: string;
		url?: string;
	}> = actions.map((action) => ({
		type: ComponentType.Button,
		style: action.style,
		label: action.label,
		...(action.style === 5
			? { url: action.url ?? action.customId }
			: { custom_id: action.customId }),
	}));

	const rows = [];
	for (let index = 0; index < buttons.length; index += 5) {
		rows.push({
			type: ComponentType.ActionRow,
			components: buttons.slice(index, index + 5),
		});
	}
	return rows as RESTPostAPIChannelMessageJSONBody["components"];
}

/** Register guild slash commands defined in discord/commands.ts. */
export const registerSlashCommandsAction = internalAction({
	args: {},
	returns: v.array(slashCommandSummary),
	handler: async () => {
		const rest = getDiscordRest();
		const commands = await registerGuildSlashCommands(rest);
		return commands.map((command) => ({
			id: command.id,
			name: command.name,
			description: command.description,
		}));
	},
});

/** List slash commands currently registered for the guild. */
export const listSlashCommandsAction = internalAction({
	args: {},
	returns: v.array(slashCommandSummary),
	handler: async () => {
		const rest = getDiscordRest();
		const commands = await listGuildSlashCommands(rest);
		return commands.map((command) => ({
			id: command.id,
			name: command.name,
			description: command.description,
		}));
	},
});
