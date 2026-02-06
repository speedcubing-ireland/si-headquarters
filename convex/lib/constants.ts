export const MAX_BULK_UPDATE_COUNT = 100;

export const NOTIFICATION_THRESHOLDS = {
	APPROACHING_MS: 48 * 60 * 60 * 1000,
	MS_PER_DAY: 24 * 60 * 60 * 1000,
} as const;

export const CRON_INTERVALS = {
	DUE_DATE_CHECK: { hours: 1 },
	REMINDER_CHECK: { minutes: 15 },
} as const;

export const INPUT_LIMITS = {
	MAX_STRING_LENGTH: 10000,
	MAX_COMMENT_LENGTH: 5000,
	MAX_TASK_TITLE_LENGTH: 200,
} as const;

export const TEAM_NAMES = {
	VOLUNTEER: "Volunteer",
	DIRECTORS: "Directors",
} as const;

export const SAT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const SCHEDULE_CACHE_TTL_MS = 5 * 60 * 1000;
export const TOKEN_VALID_BUFFER_SEC = 60;

export const REMINDER_PATTERNS = {
	DAILY: "daily",
	WEEKLY: "weekly",
	MONTHLY: "monthly",
} as const;

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
