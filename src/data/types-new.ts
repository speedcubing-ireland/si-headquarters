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

export const SEEDED_TEAM_NAMES = [
	"Directors",
	"Delegates",
	"Competitions Team",
	"Social Media Team",
	"Finance Team",
	"Merch Team",
	"Software Team",
	"Graphics Team",
	"Volunteer",
] as const;

export type SeededTeamName = (typeof SEEDED_TEAM_NAMES)[number];

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

export const DEFAULT_PHASES: Array<Omit<CompetitionPhase, "id">> = [
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
	parentDisplayName?: string | null;
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

export type CommentReaction = {
	emoji: string;
	users: User[];
};

export type CommentParentType = "task" | "update";

export type Comment = {
	id: string;
	parentType: CommentParentType;
	parentId: string;
	parentCommentId: string | null;
	author: User;
	content: string;
	createdAt: string;
	updatedAt: string;
	contentUpdatedAt?: string;
	reactions: CommentReaction[];
};

export type ActivityEntity = "task" | "competition" | "update";

export type ActivityType =
	| "created"
	| "updated"
	| "status_changed"
	| "priority_changed"
	| "assignee_changed"
	| "due_date_changed"
	| "phase_changed"
	| "label_added"
	| "label_removed"
	| "comment_added"
	| "comment_edited"
	| "comment_deleted"
	| "archived"
	| "unarchived"
	| "approved"
	| "unapproved"
	| "resources_changed";

export type ActivityEntry = {
	id: string;
	entityType: ActivityEntity;
	entityId: string;
	type: ActivityType;
	actor: User;
	timestamp: string;
	oldValue?: string;
	newValue?: string;
	metadata?: Record<string, unknown>;
	entityTitle?: string;
	entityIdentifier?: string;
};

export type TemplateTask = {
	title: string;
	description: string;
	status: TaskStatus;
	priority: TaskPriority;
	labels: string[];
	ownerType: "team" | "user" | null;
	ownerId: string | null;
	suggestedAssigneeId: string | null;
	phase: string | null;
	requiredApprovalByTeamNames?: string[];
	subTasks?: TemplateTask[];
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
	labels: string[];
};

export type Competition = {
	id: string;
	name: string;
	description: string;
	compStart: string;
	compEnd: string;
	compLead: User | null;
	leadDelegate: User | null;
	organisers: User[];
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

export type NotificationType =
	| "task_assigned"
	| "task_unassigned"
	| "task_mentioned"
	| "task_status_changed"
	| "task_awaiting_review"
	| "due_date_approaching"
	| "due_date_overdue"
	| "comment_added"
	| "relation_blocked"
	| "relation_unblocked"
	| "competition_phase_changed"
	| "progress_update_added"
	| "reminder_triggered";

export type NotificationStatus = "unread" | "read" | "archived";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationAction = {
	id: string;
	label: string;
	type: "navigate" | "dismiss" | "snooze" | "mark_done" | "custom";
	payload?: Record<string, unknown>;
};

export type Notification = {
	id: string;
	userId: string;
	type: NotificationType;
	priority: NotificationPriority;
	status: NotificationStatus;
	title: string;
	message: string;
	body?: string;
	entityType: "task" | "competition" | "comment" | "user" | "reminder";
	entityId: string;
	parentEntityId?: string;
	metadata: {
		actorId?: string;
		actorName?: string;
		actorAvatarUrl?: string;
		oldValue?: string;
		newValue?: string;
		actions?: NotificationAction[];
		webhookUrl?: string;
		processedAt?: string;
		processedBy?: string;
	};
	createdAt: string;
	readAt?: string;
	archivedAt?: string;
	scheduledFor?: string;
	isBatchable: boolean;
	batchKey?: string;
};

export type ReminderType = "one_time" | "recurring";

export type ReminderStatus =
	| "pending"
	| "triggered"
	| "dismissed"
	| "completed";

export type RecurringPattern = "daily" | "weekly" | "monthly" | "custom";

export type Reminder = {
	id: string;
	userId: string;
	entityType: "task";
	entityId: string;
	type: ReminderType;
	remindAt: string;
	recurringPattern?: RecurringPattern;
	recurringConfig?: {
		daysOfWeek?: number[];
		dayOfMonth?: number;
		cronExpression?: string;
	};
	endDate?: string;
	status: ReminderStatus;
	triggeredAt?: string;
	dismissedAt?: string;
	message?: string;
	priority: NotificationPriority;
	metadata: {
		jobId?: string;
		workerNode?: string;
		retryCount?: number;
		lastError?: string;
		externalSchedulerId?: string;
		webhookUrl?: string;
	};

	createdAt: string;
	updatedAt: string;
};

export type NotificationPreference = {
	userId: string;
	notificationType: NotificationType;
	enabled: boolean;
	channels: ("in_app" | "email" | "push")[];
	digestFrequency?: "immediate" | "hourly" | "daily";
};

export const DEFAULT_LABELS: TaskLabel[] = [
	{ id: "label-1", name: "Bug", color: "#ef4444" },
	{ id: "label-2", name: "Feature", color: "#3b82f6" },
	{ id: "label-3", name: "Improvement", color: "#8b5cf6" },
	{ id: "label-4", name: "Documentation", color: "#06b6d4" },
	{ id: "label-5", name: "Urgent", color: "#f97316" },
	{ id: "label-6", name: "Review Needed", color: "#eab308" },
	{ id: "label-7", name: "Blocked", color: "#dc2626" },
	{ id: "label-8", name: "Quick Win", color: "#22c55e" },
	{ id: "label-venue", name: "Venue", color: "#3b82f6" },
	{ id: "label-budget", name: "Budget", color: "#22c55e" },
	{ id: "label-marketing", name: "Marketing", color: "#a855f7" },
	{ id: "label-design", name: "Design", color: "#ec4899" },
	{ id: "label-wca", name: "WCA", color: "#f97316" },
	{ id: "label-registration", name: "Registration", color: "#06b6d4" },
	{ id: "label-logistics", name: "Logistics", color: "#64748b" },
	{ id: "label-sponsors", name: "Sponsors", color: "#eab308" },
];
