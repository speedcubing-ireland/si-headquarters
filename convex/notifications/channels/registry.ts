import { emailChannelAdapter } from "./email";
import { inAppChannelAdapter } from "./in_app";
import { pushChannelAdapter } from "./push";
import { slackChannelAdapter } from "./slack";

export const notificationChannelRegistry = {
	in_app: inAppChannelAdapter,
	email: emailChannelAdapter,
	slack: slackChannelAdapter,
	push: pushChannelAdapter,
} as const;

export function getChannelAdapter<
	TChannel extends keyof typeof notificationChannelRegistry,
>(channel: TChannel): (typeof notificationChannelRegistry)[TChannel] {
	return notificationChannelRegistry[channel];
}
