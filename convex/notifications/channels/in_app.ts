import type { NotificationChannelAdapter } from "./base";

type InAppChannelPayload = Record<string, never>;

export const inAppChannelAdapter: NotificationChannelAdapter<InAppChannelPayload> =
	{
		channel: "in_app",
		isConfigured: () => true,
		send: async () => ({ ok: true }),
	};
