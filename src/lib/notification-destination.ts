export type NotificationDestinationInput = {
	entityType: string;
	entityId: string;
	parentEntityId?: string;
};

export type NotificationDestination =
	| {
			to: "/tasks/$id";
			params: { id: string };
	  }
	| {
			to: "/competitions/$id";
			params: { id: string };
	  }
	| null;

export function getNotificationDestination(
	notification: NotificationDestinationInput,
): NotificationDestination {
	switch (notification.entityType) {
		case "task":
			return { to: "/tasks/$id", params: { id: notification.entityId } };
		case "competition":
			return {
				to: "/competitions/$id",
				params: { id: notification.entityId },
			};
		case "comment":
		case "reminder":
			return notification.parentEntityId
				? { to: "/tasks/$id", params: { id: notification.parentEntityId } }
				: null;
		default:
			return null;
	}
}
