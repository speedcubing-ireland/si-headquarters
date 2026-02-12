import type { NotificationEmitInput, NotificationType } from "../lib/notificationTypes";

export type NotificationEventKey = NotificationType;

export type NotificationDeliveryPolicy = {
	includeEntitySubscribers: boolean;
	suppressActorRecipient: boolean;
};

export type NotificationCatalogEntry = {
	key: NotificationEventKey;
	delivery: NotificationDeliveryPolicy;
};

export type BuildEmitInputArgs = {
	eventKey: NotificationEventKey;
	base: Omit<
		NotificationEmitInput,
		"includeEntitySubscribers" | "suppressActorRecipient"
	>;
	overrides?: Partial<NotificationDeliveryPolicy>;
};
