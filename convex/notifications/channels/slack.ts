import type { NotificationChannelAdapter } from "./base";

type SlackChannelPayload = Record<string, never>;

export const slackChannelAdapter: NotificationChannelAdapter<SlackChannelPayload> =
	{
		channel: "slack",
		isConfigured: () => false,
		send: async () => ({
			status: "failed",
			error: "slack_channel_not_configured",
		}),
	};
