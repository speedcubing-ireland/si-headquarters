"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { getDiscordRest, listGuildChannels, sendDirectMessage } from "./client";
import {
	listGuildSlashCommands,
	registerGuildSlashCommands,
} from "./slashCommands";
import { buildCompetitionCountMessage } from "./interactions";
import { requireDiscordDmUserId, requireDiscordGuildId } from "./config";

const discordChannelSummary = v.object({
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
