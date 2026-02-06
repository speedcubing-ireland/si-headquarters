import type { Id } from "../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type {
	TaskStatus,
	TaskPriority,
	LinkedResource,
	PhaseUI,
} from "../../convex/lib/types";

/** A single user as returned by users.listUsers */
export type User = FunctionReturnType<typeof api.users.listUsers>[number];

/** A single task as returned by tasks.getForUI */
export type Task = NonNullable<FunctionReturnType<typeof api.tasks.getForUI>>;

/** A single competition as returned by competitions.getForUI */
export type Competition = NonNullable<
	FunctionReturnType<typeof api.competitions.getForUI>
>;

/** A progress update embedded within a competition */
export type ProgressUpdate = Competition["progressUpdates"][number];

/** A single comment as returned by comments.listForUI */
export type Comment = FunctionReturnType<typeof api.comments.listForUI>[number];

/** A single activity entry as returned by activity.listForEntity */
export type ActivityEntry = FunctionReturnType<
	typeof api.activity.listForEntity
>[number];

/** A single notification as returned by notifications.listForUser */
export type Notification = FunctionReturnType<
	typeof api.notifications.listForUser
>[number];

/** A single reminder as returned by reminders.listForUser */
export type Reminder = FunctionReturnType<
	typeof api.reminders.listForUser
>[number];

export { TASK_STATUSES, TASK_PRIORITIES } from "../../convex/lib/validators";

export type { TaskStatus, TaskPriority };

export type GoogleSheetResource = Extract<
	LinkedResource,
	{ type: "google-sheet" }
>;
export type CanvaResource = Extract<LinkedResource, { type: "canva-design" }>;

export type { LinkedResource };

export type CompetitionPhase = PhaseUI;

export type Team = {
	id: Id<"teams">;
	name: string;
	members: User[];
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

export type TaskLabel = {
	id: Id<"labels">;
	name: string;
	color: string;
};

export type TaskParent =
	| { type: "task"; linkedId: Id<"tasks"> }
	| { type: "competition"; linkedId: Id<"competitions"> }
	| null;

export type CommentReaction = Comment["reactions"][number];

export type CommentParentType = "task" | "update";

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

export type NonCompWeekendInfo = {
	id: Id<"weekendOverrides">;
	satDate: string;
	eventNote: string;
	reserved: boolean;
	announced: boolean;
};

export type Weekend = {
	id: Id<"weekendOverrides">;
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
	id: Id<"notifications">;
	label: string;
	type: "navigate" | "dismiss" | "snooze" | "mark_done" | "custom";
	payload?: Record<string, unknown>;
};

export type ReminderType = "one_time" | "recurring";

export type ReminderStatus =
	| "pending"
	| "triggered"
	| "dismissed"
	| "completed";

export type RecurringPattern = "daily" | "weekly" | "monthly" | "custom";

export type NotificationPreference = {
	userId: Id<"users">;
	notificationType: NotificationType;
	enabled: boolean;
	channels: ("in_app" | "email" | "push")[];
	digestFrequency?: "immediate" | "hourly" | "daily";
};

/** Seed data for labels (name + color only; id comes from DB after insert). */
export const DEFAULT_LABELS: Array<Omit<TaskLabel, "id">> = [
	{ name: "Bug", color: "#ef4444" },
	{ name: "Feature", color: "#3b82f6" },
	{ name: "Improvement", color: "#8b5cf6" },
	{ name: "Documentation", color: "#06b6d4" },
	{ name: "Urgent", color: "#f97316" },
	{ name: "Review Needed", color: "#eab308" },
	{ name: "Blocked", color: "#dc2626" },
	{ name: "Quick Win", color: "#22c55e" },
	{ name: "Venue", color: "#3b82f6" },
	{ name: "Budget", color: "#22c55e" },
	{ name: "Marketing", color: "#a855f7" },
	{ name: "Design", color: "#ec4899" },
	{ name: "WCA", color: "#f97316" },
	{ name: "Registration", color: "#06b6d4" },
	{ name: "Logistics", color: "#64748b" },
	{ name: "Sponsors", color: "#eab308" },
];

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
