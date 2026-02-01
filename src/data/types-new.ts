export type User = {
	id: string;
	name: string;
	avatarUrl: string;
};

export type Team = {
	id: string;
	name: string;
	members: User[];
};

export type GoogleSheetResource = {
	type: "google-sheet";
	sheetId: string;
};

export type CanvaResource = {
	type: "canva-design";
	designId: string;
};

export type LinkedResource = GoogleSheetResource | CanvaResource;

export type ProgressUpdate = {
	id: string;
	timestamp: string;
	postedBy: User;
	status: "on-track" | "at-risk" | "off-track";
	message?: string;
	reactions: CommentReaction[];
};

export type CompetitionPhase = {
	id: string;
	name: string;
	description: string;
};

export type CompetitionPhaseTemplate = Omit<CompetitionPhase, "id">;

export const DEFAULT_PHASES: CompetitionPhaseTemplate[] = [
	{ name: "Concept", description: "Still being discussed, no dates/venue yet" },
	{
		name: "Pre-Announcement",
		description: "Details being finalised, dates/venue confirmed",
	},
	{
		name: "Post-Announcement",
		description:
			"Announcement made, details confirmed, registration not closed",
	},
	{
		name: "Pre-Competition",
		description: "Registration closed, preparation in progress",
	},
	{
		name: "Post-Competition",
		description: "Competition completed, pending finalisation",
	},
	{
		name: "Archive",
		description: "All tasks completed, no further action required",
	},
] as const;

export const COMPETITION_PHASE_KEYS = [
	"concept",
	"pre-announcement",
	"post-announcement",
	"pre-competition",
	"post-competition",
	"archive",
] as const;

export type CompetitionPhaseKey = (typeof COMPETITION_PHASE_KEYS)[number];

export const TASK_STATUS = [
	"backlog",
	"to-do",
	"in-progress",
	"awaiting-review",
	"done",
	"cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

export const TASK_PRIORITY = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITY)[number];

export type TaskLabel = {
	id: string;
	name: string;
	color: string;
};

export type TaskParent =
	| { type: "task"; linkedId: string }
	| { type: "phase"; linkedId: string }
	| { type: "competition"; linkedId: string }
	| null;

export type Task = {
	id: string;
	identifier: string;
	parent: TaskParent;
	title: string;
	description: string;
	owner: Team | User | null;
	assignee: User | null;
	phase: CompetitionPhase | null;
	status: TaskStatus;
	priority: TaskPriority;
	dueDate: string | null;
	requiredApprovalBy: (Team | User)[];
	approvedBy: (Team | User)[];
	labels: TaskLabel[];
	resources: LinkedResource[];
	subTasks: Task[];
	createdAt: string;
	updatedAt: string;
	archivedAt: string | null;
};

// Comment types for task and update discussions
export type CommentReaction = {
	emoji: string;
	users: User[];
};

export type CommentParentType = "task" | "update";

export type Comment = {
	id: string;
	parentType: CommentParentType;
	parentId: string; // taskId or updateId
	parentCommentId: string | null; // null for top-level, set for replies
	author: User;
	content: string;
	createdAt: string;
	updatedAt: string;
	reactions: CommentReaction[];
};

// Activity log types for tracking changes
export type ActivityType =
	| "created"
	| "updated"
	| "status_changed"
	| "priority_changed"
	| "assignee_changed"
	| "due_date_changed"
	| "label_added"
	| "label_removed"
	| "comment_added"
	| "comment_edited"
	| "comment_deleted"
	| "archived"
	| "unarchived";

export type ActivityEntry = {
	id: string;
	entityType: "task" | "update" | "competition";
	entityId: string;
	type: ActivityType;
	actor: User;
	timestamp: string;
	oldValue?: string;
	newValue?: string;
	metadata?: Record<string, unknown>;
};

export type ArchivedTask = Task & {
	archivedAt: string;
};

// Template types for quick creation
export type TemplateTask = {
	title: string;
	description: string;
	status: TaskStatus;
	priority: TaskPriority;
	labels: string[]; // label IDs
	ownerType: "team" | "user" | null;
	ownerId: string | null;
	suggestedAssigneeId: string | null;
	phase: string | null; // phase name or null
};

export type CompetitionTemplate = {
	id: string;
	name: string;
	description: string;
	icon: string;
	defaultTasks: TemplateTask[];
};

export type TaskTemplate = {
	id: string;
	name: string;
	description: string;
	icon: string;
	title: string;
	descriptionTemplate: string;
	status: TaskStatus;
	priority: TaskPriority;
	labels: string[]; // label IDs
};

export type Competition = {
	id: string;
	name: string;
	description: string;
	// Core competition scheduling
	compStart: string;
	compEnd: string;
	// High-level ownership
	compLead: User | null;
	leadDelegate: User | null;
	organisers: User[];
	// Phase workflow & progress
	phases: CompetitionPhase[];
	currentPhaseIdx: number;
	progressUpdates: ProgressUpdate[];
	compSheet: GoogleSheetResource | null;
	tasks: Task[];
	createdAt: string;
	updatedAt: string;
};

export type NonCompWeekendInfo = {
	id: string;
	satDate: string;
	eventNote: string;
	reserved: boolean;
	announced: boolean;
};

export type Weekend = {
	id: string;
	satDate: string;
} & (
	| {
			competition: Competition;
			weekendInfo: null;
	  }
	| {
			competition: null;
			weekendInfo: NonCompWeekendInfo;
	  }
);

// Notification types - designed for easy backend integration
// Backend can push notifications via WebSocket/API with this structure
export type NotificationType =
	| "task_assigned" // You were assigned to a task
	| "task_unassigned" // You were unassigned from a task
	| "task_mentioned" // You were mentioned in a comment
	| "task_status_changed" // Task status changed (for subscribers)
	| "due_date_approaching" // Due date is coming up
	| "due_date_overdue" // Task is overdue
	| "comment_added" // New comment on subscribed task
	| "relation_blocked" // Task you depend on is blocked
	| "relation_unblocked" // Blocker resolved
	| "competition_phase_changed" // Competition moved to new phase
	| "progress_update_added" // New progress update on competition
	| "reminder_triggered"; // Custom reminder fired

export type NotificationStatus = "unread" | "read" | "archived";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

// Actions that can be taken directly from a notification
export type NotificationAction = {
	id: string;
	label: string;
	type: "navigate" | "dismiss" | "snooze" | "mark_done" | "custom";
	payload?: Record<string, unknown>; // For custom handlers
};

export type Notification = {
	id: string;
	userId: string; // Target user - allows backend filtering
	type: NotificationType;
	priority: NotificationPriority;
	status: NotificationStatus;

	// Content
	title: string;
	message: string;
	body?: string; // Extended markdown content

	// Entity references - for navigation and context
	entityType: "task" | "competition" | "comment" | "user" | "reminder";
	entityId: string;
	parentEntityId?: string; // e.g., taskId for a comment

	// Metadata for rendering and actions
	metadata: {
		actorId?: string; // Who triggered this
		actorName?: string;
		actorAvatarUrl?: string;
		oldValue?: string;
		newValue?: string;
		actions?: NotificationAction[];
		// For backend integration
		webhookUrl?: string;
		processedAt?: string;
		processedBy?: string;
	};

	// Timestamps
	createdAt: string;
	readAt?: string;
	archivedAt?: string;
	scheduledFor?: string; // For scheduled/digest notifications

	// For batching/digest (future backend feature)
	isBatchable: boolean;
	batchKey?: string;
};

// Reminder types - designed for scheduler/task runner integration
export type ReminderType = "one_time" | "recurring";

export type ReminderStatus =
	| "pending" // Scheduled but not yet triggered
	| "triggered" // Time reached, notification created
	| "dismissed" // User dismissed
	| "completed"; // Task completed before reminder

export type RecurringPattern = "daily" | "weekly" | "monthly" | "custom"; // For cron-like expressions (future)

export type Reminder = {
	id: string;
	userId: string; // Who gets reminded
	entityType: "task";
	entityId: string; // Which task

	// Scheduling
	type: ReminderType;
	remindAt: string; // ISO timestamp - when to trigger
	recurringPattern?: RecurringPattern;
	recurringConfig?: {
		daysOfWeek?: number[]; // 0-6 for weekly
		dayOfMonth?: number; // 1-31 for monthly
		cronExpression?: string; // For custom (future)
	};
	endDate?: string; // Stop recurring after this date

	// Status tracking
	status: ReminderStatus;
	triggeredAt?: string;
	dismissedAt?: string;

	// Content
	message?: string; // Custom message (optional)
	priority: NotificationPriority;

	// Backend integration hooks
	metadata: {
		jobId?: string; // ID in task queue (e.g., Bull, Celery)
		workerNode?: string; // Which worker processed this
		retryCount?: number;
		lastError?: string;
		// For external schedulers
		externalSchedulerId?: string;
		webhookUrl?: string;
	};

	createdAt: string;
	updatedAt: string;
};

// Notification preferences per user (future backend feature)
export type NotificationPreference = {
	userId: string;
	notificationType: NotificationType;
	enabled: boolean;
	channels: ("in_app" | "email" | "push")[];
	digestFrequency?: "immediate" | "hourly" | "daily";
};

export const DEFAULT_LABELS: TaskLabel[] = [
	// Generic labels
	{ id: "label-1", name: "Bug", color: "#ef4444" },
	{ id: "label-2", name: "Feature", color: "#3b82f6" },
	{ id: "label-3", name: "Improvement", color: "#8b5cf6" },
	{ id: "label-4", name: "Documentation", color: "#06b6d4" },
	{ id: "label-5", name: "Urgent", color: "#f97316" },
	{ id: "label-6", name: "Review Needed", color: "#eab308" },
	{ id: "label-7", name: "Blocked", color: "#dc2626" },
	{ id: "label-8", name: "Quick Win", color: "#22c55e" },
	// Competition-specific labels
	{ id: "label-venue", name: "Venue", color: "#3b82f6" },
	{ id: "label-budget", name: "Budget", color: "#22c55e" },
	{ id: "label-marketing", name: "Marketing", color: "#a855f7" },
	{ id: "label-design", name: "Design", color: "#ec4899" },
	{ id: "label-wca", name: "WCA", color: "#f97316" },
	{ id: "label-registration", name: "Registration", color: "#06b6d4" },
	{ id: "label-logistics", name: "Logistics", color: "#64748b" },
	{ id: "label-sponsors", name: "Sponsors", color: "#eab308" },
];
