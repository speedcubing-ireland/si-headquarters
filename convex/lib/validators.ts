import { v } from "convex/values";
import type { Infer } from "convex/values";

export const TASK_STATUSES = [
	"backlog",
	"to-do",
	"in-progress",
	"awaiting-review",
	"done",
	"cancelled",
] as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const taskStatus = v.union(...TASK_STATUSES.map((s) => v.literal(s)));

export const taskPriority = v.union(
	...TASK_PRIORITIES.map((p) => v.literal(p)),
);

export const progressUpdateStatus = v.union(
	v.literal("on-track"),
	v.literal("at-risk"),
	v.literal("off-track"),
);

export const reminderStatus = v.union(
	v.literal("pending"),
	v.literal("triggered"),
	v.literal("dismissed"),
	v.literal("completed"),
);

export const reminderType = v.union(
	v.literal("one_time"),
	v.literal("recurring"),
);

export const parentType = v.union(v.literal("task"), v.literal("update"));

export const entityType = v.union(
	v.literal("task"),
	v.literal("update"),
	v.literal("competition"),
);

export const activityType = v.union(
	v.literal("created"),
	v.literal("updated"),
	v.literal("status_changed"),
	v.literal("priority_changed"),
	v.literal("assignee_changed"),
	v.literal("due_date_changed"),
	v.literal("phase_changed"),
	v.literal("label_added"),
	v.literal("label_removed"),
	v.literal("comment_added"),
	v.literal("comment_edited"),
	v.literal("comment_deleted"),
	v.literal("archived"),
	v.literal("unarchived"),
	v.literal("approved"),
	v.literal("unapproved"),
	v.literal("resources_changed"),
);

export const ownerType = v.union(v.literal("user"), v.literal("team"));

export const userShape = v.object({
	id: v.id("users"),
	name: v.string(),
	avatarUrl: v.string(),
});

export const teamShape = v.object({
	id: v.id("teams"),
	name: v.string(),
	members: v.array(userShape),
});

export const labelShape = v.object({
	id: v.id("labels"),
	name: v.string(),
	color: v.string(),
});
export const phaseShape = v.object({
	id: v.id("phases"),
	name: v.string(),
	description: v.string(),
});

export const approvalShape = v.union(userShape, teamShape);

export type UserUI = Infer<typeof userShape>;
export type TeamUI = Infer<typeof teamShape>;
export type LabelUI = Infer<typeof labelShape>;
export type PhaseUI = Infer<typeof phaseShape>;

export const googleSheetResource = v.object({
	type: v.literal("google-sheet"),
	sheetId: v.string(),
});

export const canvaResource = v.object({
	type: v.literal("canva-design"),
	designId: v.string(),
});

export const linkedResource = v.union(googleSheetResource, canvaResource);

export const activityMetadata = v.optional(
	v.object({
		fieldName: v.optional(v.string()),
		addedLabels: v.optional(v.array(v.string())),
		removedLabels: v.optional(v.array(v.string())),
		message: v.optional(v.string()),
	}),
);
export type ActivityMetadata = Infer<typeof activityMetadata>;

export const reminderMetadata = v.optional(
	v.object({
		jobId: v.optional(v.string()),
		workerNode: v.optional(v.string()),
		retryCount: v.optional(v.number()),
		lastError: v.optional(v.string()),
		externalSchedulerId: v.optional(v.string()),
		webhookUrl: v.optional(v.string()),
	}),
);

export const reminderRecurringConfig = v.optional(
	v.object({
		daysOfWeek: v.optional(v.array(v.number())),
		dayOfMonth: v.optional(v.number()),
		cronExpression: v.optional(v.string()),
	}),
);

export const viewEntity = v.union(
	v.literal("tasks"),
	v.literal("competitions"),
);
export const savedViewShape = v.object({
	id: v.id("savedViews"),
	name: v.string(),
	description: v.optional(v.string()),
	entity: viewEntity,
	pageId: v.string(),
	filtersJson: v.string(),
	displaySettingsJson: v.string(),
	createdAt: v.number(),
	updatedAt: v.number(),
	lastUsedAt: v.optional(v.number()),
});
