import { REST } from "@discordjs/rest";

export function createDiscordRest(token: string): REST {
	return new REST({ version: "10" }).setToken(token);
}
