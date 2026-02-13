export const MAX_BULK_UPDATE_COUNT = 100;

export const NOTIFICATION_THRESHOLDS = {
	APPROACHING_MS: 48 * 60 * 60 * 1000,
	MS_PER_DAY: 24 * 60 * 60 * 1000,
} as const;

export const CRON_EXPRESSIONS = {
	DUE_DATE_CHECK_DAILY_UTC: "0 5 * * *",
} as const;

export const NOTIFICATION_DEFAULTS = {
	TIMEZONE: "Europe/Dublin",
	DAILY_DIGEST_SEND_MINUTE: 9 * 60,
	THREE_DAILY_DIGEST_SEND_MINUTES: [9 * 60, 13 * 60, 18 * 60] as const,
	MAX_DIGEST_LOOKAHEAD_MINUTES: 26 * 60,
} as const;

export const INPUT_LIMITS = {
	MAX_STRING_LENGTH: 10000,
	MAX_COMMENT_LENGTH: 5000,
	MAX_TASK_TITLE_LENGTH: 200,
} as const;

export const TEAM_NAMES = {
	VOLUNTEER: "Volunteer",
	DIRECTORS: "Directors",
	FINANCE: "Finance Team",
} as const;

export const SAT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const SCHEDULE_CACHE_TTL_MS = 5 * 60 * 1000;
export const TOKEN_VALID_BUFFER_SEC = 60;

export const REMINDER_PATTERNS = {
	DAILY: "daily",
	WEEKLY: "weekly",
	MONTHLY: "monthly",
} as const;

export const NOTIFICATION_LIST_LIMITS = {
	DEFAULT: 250,
	MAX: 500,
} as const;

export const MINUTES_IN_DAY = 24 * 60;

export const STATUS_LABELS: Record<string, string> = {
	backlog: "Backlog",
	"to-do": "To Do",
	"in-progress": "In Progress",
	"awaiting-review": "Awaiting Review",
	done: "Done",
	cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<string, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	urgent: "Urgent",
};

export const PROGRESS_STATUS_LABELS: Record<string, string> = {
	"on-track": "On track",
	"at-risk": "At risk",
	"off-track": "Off track",
};
