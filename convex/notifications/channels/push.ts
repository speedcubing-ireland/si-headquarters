import type { NotificationChannelAdapter } from "./base";

type PushChannelPayload = Record<string, never>;

export const pushChannelAdapter: NotificationChannelAdapter<PushChannelPayload> =
	{
		channel: "push",
		isConfigured: () => false,
		send: async () => ({ ok: false, error: "push_channel_not_configured" }),
	};
