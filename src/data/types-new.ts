import type { Id } from "../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type {
	TaskStatus,
	TaskPriority,
	LinkedResource,
	PhaseUI,
	LinkedActionType,
	LinkedActionRunPermission,
	LinkedActionConfig,
	LinkedTaskActionStatus,
	CanvaTemplateActionConfig,
	LinkedSheetActionConfig,
} from "../../convex/lib/types";
import {
	DEFAULT_PHASES,
	COMPETITION_PHASE_KEYS,
	type SeededLabelName,
	type SeededTeamName,
} from "../../convex/lib/seedData";
export type { SeededLabelName, SeededTeamName };
export { DEFAULT_PHASES, COMPETITION_PHASE_KEYS };

export type User = FunctionReturnType<typeof api.users.listUsers>[number];

export type Task = NonNullable<FunctionReturnType<typeof api.tasks.getForUI>>;

export type Competition = NonNullable<
	FunctionReturnType<typeof api.competitions.getForUI>
>;

export type Sponsor = FunctionReturnType<typeof api.sponsors.list>[number];

export type SponsorshipAuction = FunctionReturnType<
	typeof api.sponsorshipAuctions.listByCompetition
>[number];

export type SponsorshipBidIntent = {
	auctionId: Id<"sponsorshipAuctions">;
	sponsorId: Id<"sponsors">;
	mode: "manual" | "proxy";
	amountCents: number;
	maxAmountCents?: number;
	isValid: boolean;
	createdAt: number;
};

export type SponsorshipBidEvent =
	FunctionReturnType<typeof api.sponsorPortal.getAuction> extends infer T
		? T extends { events: infer Events }
			? Events extends Array<infer Event>
				? Event
				: never
			: never
		: never;

export type CompetitionSponsorProperty = Pick<
	Competition,
	"sponsorPropertyStatus" | "sponsorPropertyDisplay" | "sponsorWinningBidCents"
>;

export type ProgressUpdate = Competition["progressUpdates"][number];

export type Comment = FunctionReturnType<typeof api.comments.listForUI>[number];

export type Notification = FunctionReturnType<
	typeof api.notifications.listForUser
>[number];

export type Reminder = FunctionReturnType<
	typeof api.reminders.listForUser
>[number];

export type LinkedActionDefinition = FunctionReturnType<
	typeof api.linkedActions.listDefinitions
>[number];

export type TaskLinkedAction = FunctionReturnType<
	typeof api.linkedActions.listForTask
>[number];

export { TASK_STATUSES, TASK_PRIORITIES } from "../../convex/lib/validators";

export type { TaskStatus, TaskPriority };

export type GoogleSheetResource = Extract<
	LinkedResource,
	{ type: "google-sheet" }
>;
export type CanvaResource = Extract<LinkedResource, { type: "canva-design" }>;

export type { LinkedResource };
export type {
	LinkedActionType,
	LinkedActionRunPermission,
	LinkedActionConfig,
	LinkedTaskActionStatus,
	CanvaTemplateActionConfig,
	LinkedSheetActionConfig,
};

export type CompetitionPhase = PhaseUI;

export type Team = {
	id: Id<"teams">;
	name: string;
	members: User[];
};

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
	labels: SeededLabelName[];
	ownerTeamName: SeededTeamName | null;
	suggestedAssigneeId?: string | null;
	phase: string | null;
	requiredApprovalByTeamNames?: SeededTeamName[];
	linkedActionShortIds?: string[];
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
	labels: SeededLabelName[];
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

export type NotificationType = Notification["type"];

export type NotificationStatus = Notification["status"];

export type NotificationPriority = Notification["priority"];

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

export type NotificationPreference = FunctionReturnType<
	typeof api.notifications.listPreferences
>[number];

export type NotificationSubscription = FunctionReturnType<
	typeof api.notifications.listSubscriptions
>[number];

export type NotificationSettings = FunctionReturnType<
	typeof api.notifications.getSettings
>;
