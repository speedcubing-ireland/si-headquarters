import type { NotificationChannel } from "../lib/notificationTypes";

export type ChannelSendResult = { ok: true } | { ok: false; error: string };

export interface NotificationChannelAdapter<TPayload> {
	channel: NotificationChannel;
	isConfigured(): boolean;
	send(payload: TPayload): Promise<ChannelSendResult>;
}
