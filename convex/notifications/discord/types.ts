import type { NotificationType } from "../lib/notificationTypes";
import type { DiscordNotificationContext } from "./context";

export type DiscordDestinationKind = "dm" | "channel";

export type DiscordActionButtonSpec = {
	customId: string;
	label: string;
	style: 1 | 2 | 3 | 4 | 5;
	url?: string;
};

export type DiscordEmbedSpec = {
	title: string;
	description?: string;
	fields?: Array<{ name: string; value: string; inline?: boolean }>;
	author?: { name: string; iconUrl?: string };
};

export type DiscordMessagePayload = DiscordEmbedSpec & {
	message: string;
	url?: string;
	actions: DiscordActionButtonSpec[];
	priority?: "urgent" | "high" | "normal";
};

export type DiscordNotificationDefinition = {
	type: NotificationType;
	viewLabel?: string;
	buildEmbed: (
		context: DiscordNotificationContext,
	) => Promise<DiscordEmbedSpec>;
	buildActions?: (
		context: DiscordNotificationContext,
	) => Promise<DiscordActionButtonSpec[]>;
};
