export function requireDiscordBotToken(): string {
	const token = process.env.DISCORD_TOKEN;
	if (!token) {
		throw new Error("DISCORD_TOKEN environment variable is not set");
	}
	return token;
}

export function requireDiscordDmUserId(): string {
	const userId = process.env.DISCORD_DM_USER_ID;
	if (!userId) {
		throw new Error("DISCORD_DM_USER_ID environment variable is not set");
	}
	return userId;
}

export function requireDiscordGuildId(): string {
	const guildId = process.env.DISCORD_GUILD_ID;
	if (!guildId) {
		throw new Error("DISCORD_GUILD_ID environment variable is not set");
	}
	return guildId;
}

/** Application ID from the Discord developer portal (snowflake). */
export function requireDiscordApplicationId(): string {
	const applicationId =
		process.env.DISCORD_APPLICATION_ID ?? process.env.DISCORD_APPLICATION_KEY;
	if (!applicationId) {
		throw new Error(
			"DISCORD_APPLICATION_ID or DISCORD_APPLICATION_KEY environment variable is not set",
		);
	}
	return applicationId;
}

/** Public key for verifying interaction webhook signatures. */
export function requireDiscordPublicKey(): string {
	const publicKey = process.env.DISCORD_PUBLIC_KEY;
	if (!publicKey) {
		throw new Error("DISCORD_PUBLIC_KEY environment variable is not set");
	}
	return publicKey;
}
