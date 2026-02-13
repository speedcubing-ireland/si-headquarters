import type { NotificationChannel } from "../lib/notificationTypes";

export type ChannelSendResult =
	| { status: "sent" }
	| { status: "in_progress"; retryAfterMs: number; reason?: string }
	| { status: "failed"; error: string };

export interface NotificationChannelAdapter<TPayload> {
	channel: NotificationChannel;
	isConfigured(): boolean;
	send(payload: TPayload): Promise<ChannelSendResult>;
}
