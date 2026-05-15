import type {
	APIChannel,
	APIMessage,
	RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import { Routes } from "discord-api-types/v10";
import type { REST } from "@discordjs/rest";
import { createDiscordRest } from "./rest";
import { requireDiscordBotToken } from "./config";

export function getDiscordRest(): REST {
	return createDiscordRest(requireDiscordBotToken());
}

export async function listGuildChannels(
	rest: REST,
	guildId: string,
): Promise<APIChannel[]> {
	return (await rest.get(Routes.guildChannels(guildId))) as APIChannel[];
}

export async function createDmChannel(
	rest: REST,
	recipientId: string,
): Promise<APIChannel> {
	return (await rest.post(Routes.userChannels(), {
		body: { recipient_id: recipientId },
	})) as APIChannel;
}

export async function sendChannelMessage(
	rest: REST,
	channelId: string,
	body: RESTPostAPIChannelMessageJSONBody,
): Promise<APIMessage> {
	return (await rest.post(Routes.channelMessages(channelId), {
		body,
	})) as APIMessage;
}

export async function sendDirectMessage(
	rest: REST,
	recipientId: string,
	body: RESTPostAPIChannelMessageJSONBody,
): Promise<APIMessage> {
	const channel = await createDmChannel(rest, recipientId);
	return await sendChannelMessage(rest, channel.id, body);
}

export async function sendWebhookMessage(
	webhookId: string,
	webhookToken: string,
	body: RESTPostAPIChannelMessageJSONBody,
): Promise<APIMessage> {
	const rest = getDiscordRest();
	return (await rest.post(Routes.webhook(webhookId, webhookToken), {
		body,
	})) as APIMessage;
}
