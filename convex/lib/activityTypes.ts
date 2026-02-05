export type ActivityEntity = "task" | "competition" | "update";

export const ACTIVITY_TYPES = [
	"created",
	"updated",
	"status_changed",
	"priority_changed",
	"assignee_changed",
	"due_date_changed",
	"phase_changed",
	"label_added",
	"label_removed",
	"comment_added",
	"comment_edited",
	"comment_deleted",
	"archived",
	"unarchived",
	"approved",
	"unapproved",
	"resources_changed",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
