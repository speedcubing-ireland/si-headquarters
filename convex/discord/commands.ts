import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

/** Guild slash commands registered via REST (no gateway). */
export const guildSlashCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] =
	[
		{
			name: "ping",
			description: "Check that Headquarters is connected to Discord",
		},
		{
			name: "dmhq",
			description: "Send yourself the interactive Headquarters DM",
		},
	];
