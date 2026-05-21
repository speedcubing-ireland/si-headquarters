import type { NotificationType } from "./lib/notificationTypes";
import type {
	NotificationCatalogEntry,
	NotificationDeliveryPolicy,
} from "./types";

const DEFAULT_DELIVERY_POLICY: NotificationDeliveryPolicy = {
	includeEntitySubscribers: true,
	suppressActorRecipient: true,
};

const TARGETED_DELIVERY_POLICY: NotificationDeliveryPolicy = {
	includeEntitySubscribers: false,
	suppressActorRecipient: true,
};

const REMINDER_DELIVERY_POLICY: NotificationDeliveryPolicy = {
	includeEntitySubscribers: false,
	suppressActorRecipient: false,
};

export const notificationCatalog = {
	task_assigned: {
		key: "task_assigned",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	task_unassigned: {
		key: "task_unassigned",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	task_mentioned: {
		key: "task_mentioned",
		delivery: TARGETED_DELIVERY_POLICY,
	},
	task_status_changed: {
		key: "task_status_changed",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	task_priority_changed: {
		key: "task_priority_changed",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	task_awaiting_review: {
		key: "task_awaiting_review",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	due_date_approaching: {
		key: "due_date_approaching",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	due_date_overdue: {
		key: "due_date_overdue",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	comment_added: {
		key: "comment_added",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	comment_replied: {
		key: "comment_replied",
		delivery: TARGETED_DELIVERY_POLICY,
	},
	relation_blocked: {
		key: "relation_blocked",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	relation_unblocked: {
		key: "relation_unblocked",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	task_approved: {
		key: "task_approved",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	task_unapproved: {
		key: "task_unapproved",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	due_date_changed: {
		key: "due_date_changed",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	competition_phase_changed: {
		key: "competition_phase_changed",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	progress_update_added: {
		key: "progress_update_added",
		delivery: DEFAULT_DELIVERY_POLICY,
	},
	reminder_triggered: {
		key: "reminder_triggered",
		delivery: REMINDER_DELIVERY_POLICY,
	},
} satisfies Record<NotificationType, NotificationCatalogEntry>;
