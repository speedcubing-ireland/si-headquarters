import type { NotificationEmitInput } from "./lib/notificationTypes";
import { notificationCatalog } from "./catalog";
import type { BuildEmitInputArgs, NotificationDeliveryPolicy } from "./types";

function resolveDeliveryPolicy(
	args: Pick<BuildEmitInputArgs, "eventKey" | "overrides">,
): NotificationDeliveryPolicy {
	const catalogPolicy = notificationCatalog[args.eventKey].delivery;
	return {
		includeEntitySubscribers:
			args.overrides?.includeEntitySubscribers ??
			catalogPolicy.includeEntitySubscribers,
		suppressActorRecipient:
			args.overrides?.suppressActorRecipient ??
			catalogPolicy.suppressActorRecipient,
	};
}

export function buildNotificationEmitInput(
	args: BuildEmitInputArgs,
): NotificationEmitInput {
	const deliveryPolicy = resolveDeliveryPolicy(args);
	return {
		...args.base,
		includeEntitySubscribers: deliveryPolicy.includeEntitySubscribers,
		suppressActorRecipient: deliveryPolicy.suppressActorRecipient,
	};
}
