import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const taskStatus = v.union(
	v.literal("backlog"),
	v.literal("to-do"),
	v.literal("in-progress"),
	v.literal("awaiting-review"),
	v.literal("done"),
	v.literal("cancelled"),
);

const taskPriority = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
	v.literal("urgent"),
);

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
	...authTables,
	numbers: defineTable({
		value: v.number(),
	}),

	phases: defineTable({
		// Stable key used in code (e.g. "concept", "pre-announcement")
		key: v.string(),
		// Human-readable label
		name: v.string(),
		// Longer description for UI/tooling
		description: v.string(),
		// Global ordering across all phases
		order: v.number(),
		// Soft-delete / visibility toggle
		archived: v.boolean(),
	}).index("by_order", ["order"]),

	teams: defineTable({
		name: v.string(),
		memberIds: v.array(v.id("users")),
	}).index("by_name", ["name"]),

	labels: defineTable({
		name: v.string(),
		color: v.string(),
		archived: v.boolean(),
	}).index("by_name", ["name"]),

	tasks: defineTable({
		identifier: v.string(),
		title: v.string(),
		description: v.string(),
		status: taskStatus,
		priority: taskPriority,
		dueDate: v.optional(v.string()),
		archived: v.boolean(),
		archivedAt: v.optional(v.string()),
		parentTaskId: v.optional(v.id("tasks")),
		parentCompetitionId: v.optional(v.string()),
		ownerId: v.optional(v.string()),
		ownerType: v.optional(v.union(v.literal("user"), v.literal("team"))),
		assigneeId: v.optional(v.id("users")),
		phaseId: v.optional(v.id("phases")),
		labelIds: v.array(v.id("labels")),
		requiredApprovalIds: v.optional(v.array(v.string())),
		approvedByIds: v.optional(v.array(v.string())),
		resources: v.optional(
			v.array(
				v.union(
					v.object({ type: v.literal("google-sheet"), sheetId: v.string() }),
					v.object({ type: v.literal("canva-design"), designId: v.string() }),
				),
			),
		),
		updatedAt: v.number(),
	})
		.index("by_archived", ["archived"])
		.index("by_parent_task", ["parentTaskId"])
		.index("by_parent_competition", ["parentCompetitionId"])
		.index("by_parent_competition_and_archived", [
			"parentCompetitionId",
			"archived",
		])
		.index("by_assignee", ["assigneeId"])
		.index("by_status", ["status"]),

	taskCounter: defineTable({
		next: v.number(),
	}),

	competitions: defineTable({
		name: v.string(),
		description: v.string(),
		compStart: v.string(),
		compEnd: v.string(),
		compLeadId: v.optional(v.id("users")),
		leadDelegateId: v.optional(v.id("users")),
		organiserIds: v.array(v.id("users")),
		compSheet: v.optional(
			v.object({ type: v.literal("google-sheet"), sheetId: v.string() }),
		),
		currentPhaseId: v.optional(v.id("phases")),
		updatedAt: v.number(),
	})
		.index("by_comp_start", ["compStart"])
		.index("by_name", ["name"]),

	competitionUpdates: defineTable({
		competitionId: v.id("competitions"),
		authorId: v.id("users"),
		status: v.union(
			v.literal("on-track"),
			v.literal("at-risk"),
			v.literal("off-track"),
		),
		message: v.optional(v.string()),
		reactions: v.array(
			v.object({
				emoji: v.string(),
				userIds: v.array(v.id("users")),
			}),
		),
		updatedAt: v.number(),
	}).index("by_competition", ["competitionId"]),

	comments: defineTable({
		parentType: v.union(v.literal("task"), v.literal("update")),
		parentId: v.string(),
		parentCommentId: v.optional(v.id("comments")),
		authorId: v.id("users"),
		content: v.string(),
		contentUpdatedAt: v.optional(v.number()),
		reactions: v.array(
			v.object({
				emoji: v.string(),
				userIds: v.array(v.id("users")),
			}),
		),
		updatedAt: v.number(),
	})
		.index("by_parent", ["parentType", "parentId"])
		.index("by_parent_comment", ["parentCommentId"]),

	activityLog: defineTable({
		entityType: v.union(
			v.literal("task"),
			v.literal("update"),
			v.literal("competition"),
		),
		entityId: v.string(),
		type: v.string(),
		actorId: v.id("users"),
		oldValue: v.optional(v.string()),
		newValue: v.optional(v.string()),
		metadata: v.optional(v.any()),
	}).index("by_entity", ["entityType", "entityId"]),

	notifications: defineTable({
		userId: v.id("users"),
		type: v.string(),
		priority: v.string(),
		status: v.union(
			v.literal("unread"),
			v.literal("read"),
			v.literal("archived"),
		),
		title: v.string(),
		message: v.string(),
		body: v.optional(v.string()),
		entityType: v.string(),
		entityId: v.string(),
		parentEntityId: v.optional(v.string()),
		metadata: v.optional(v.any()),
		readAt: v.optional(v.number()),
		archivedAt: v.optional(v.number()),
		scheduledFor: v.optional(v.number()),
		isBatchable: v.boolean(),
		batchKey: v.optional(v.string()),
	})
		.index("by_user", ["userId"])
		.index("by_user_and_status", ["userId", "status"]),

	reminders: defineTable({
		userId: v.id("users"),
		entityType: v.literal("task"),
		entityId: v.string(),
		type: v.union(v.literal("one_time"), v.literal("recurring")),
		remindAt: v.number(),
		recurringPattern: v.optional(v.string()),
		recurringConfig: v.optional(v.any()),
		endDate: v.optional(v.string()),
		status: v.union(
			v.literal("pending"),
			v.literal("triggered"),
			v.literal("dismissed"),
			v.literal("completed"),
		),
		triggeredAt: v.optional(v.number()),
		dismissedAt: v.optional(v.number()),
		message: v.optional(v.string()),
		priority: v.string(),
		metadata: v.optional(v.any()),
		updatedAt: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_user_and_status", ["userId", "status"])
		.index("by_user_entityId_status", ["userId", "entityId", "status"])
		.index("by_remind_at", ["remindAt"]),

	savedViews: defineTable({
		userId: v.id("users"),
		entity: v.union(v.literal("tasks"), v.literal("competitions")),
		pageId: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		filtersJson: v.string(),
		displaySettingsJson: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
		lastUsedAt: v.optional(v.number()),
	})
		.index("by_user", ["userId"])
		.index("by_user_entity_page", ["userId", "entity", "pageId"]),

	weekendOverrides: defineTable({
		satDate: v.string(),
		eventNote: v.optional(v.string()),
		reserved: v.optional(v.boolean()),
		announced: v.optional(v.boolean()),
		updatedAt: v.number(),
	}).index("by_sat_date", ["satDate"]),
});
