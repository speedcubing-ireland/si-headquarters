import type { RESTGetAPIApplicationGuildCommandsResult } from "discord-api-types/v10";
import { Routes } from "discord-api-types/v10";
import type { REST } from "@discordjs/rest";
import { guildSlashCommands } from "./commands";
import { requireDiscordApplicationId, requireDiscordGuildId } from "./config";

export async function registerGuildSlashCommands(
	rest: REST,
): Promise<RESTGetAPIApplicationGuildCommandsResult> {
	const applicationId = requireDiscordApplicationId();
	const guildId = requireDiscordGuildId();

	return (await rest.put(
		Routes.applicationGuildCommands(applicationId, guildId),
		{ body: guildSlashCommands },
	)) as RESTGetAPIApplicationGuildCommandsResult;
}

export async function listGuildSlashCommands(
	rest: REST,
): Promise<RESTGetAPIApplicationGuildCommandsResult> {
	const applicationId = requireDiscordApplicationId();
	const guildId = requireDiscordGuildId();

	return (await rest.get(
		Routes.applicationGuildCommands(applicationId, guildId),
	)) as RESTGetAPIApplicationGuildCommandsResult;
}
