/**
 * Generate a DiceBear avatar URL based on a name (deterministic).
 * Uses the name as seed for consistent generation across sessions.
 */
export function getDiceBearAvatarUrl(name: string): string {
	const encodedName = encodeURIComponent(name.trim() || "user");
	return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodedName}`;
}

export function resolveUserAvatarUrl(user: {
	name?: string | null;
	discordAvatarUrl?: string | null;
}): string {
	if (
		typeof user.discordAvatarUrl === "string" &&
		user.discordAvatarUrl.trim()
	) {
		return user.discordAvatarUrl;
	}
	return getDiceBearAvatarUrl(user.name ?? "user");
}
