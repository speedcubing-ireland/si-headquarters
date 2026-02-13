import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
	taskStatus,
	taskPriority,
	reminderMetadata,
	reminderRecurringConfig,
} from "./lib/validators";
import {
	notificationMetadata,
	notificationType,
	notificationPriority,
	notificationChannel,
	notificationDigestMode,
	notificationDispatchStatus,
	notificationSubscriberEntityType,
} from "./notifications/lib/validators";
import {
	sponsorshipAuctionFramework,
	sponsorshipAuctionState,
	sponsorshipEmailDispatchStatus,
	sponsorshipEmailType,
	sponsorshipBidIntentMode,
} from "./lib/sponsorshipValidators";

export default defineSchema({
	...authTables,
	numbers: defineTable({
		value: v.number(),
	}),

	phases: defineTable({
		key: v.string(),
		name: v.string(),
		description: v.string(),
		order: v.number(),
		archived: v.boolean(),
	}).index("by_order", ["order"]),

	teams: defineTable({
		name: v.string(),
		memberIds: v.array(v.id("users")),
	}).index("by_name", ["name"]),

	pendingTeamMembers: defineTable({
		email: v.string(),
		teamId: v.id("teams"),
		createdById: v.id("users"),
		createdAt: v.number(),
	})
		.index("by_email", ["email"])
		.index("by_team_and_email", ["teamId", "email"]),

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
		parentCompetitionId: v.optional(v.id("competitions")),
		ownerId: v.optional(v.union(v.id("users"), v.id("teams"))),
		ownerType: v.optional(v.union(v.literal("user"), v.literal("team"))),
		assigneeId: v.optional(v.id("users")),
		phaseId: v.optional(v.id("phases")),
		labelIds: v.array(v.id("labels")),
		requiredApprovalIds: v.optional(v.array(v.string())),
		approvedByIds: v.optional(v.array(v.id("users"))),
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
		.index("by_parent_competition_and_archived", [
			"parentCompetitionId",
			"archived",
		])
		.index("by_phase_and_archived", ["phaseId", "archived"])
		.index("by_assignee", ["assigneeId"])
		.index("by_status", ["status"]),

	taskRelations: defineTable({
		blockedTaskId: v.id("tasks"),
		blockingTaskId: v.id("tasks"),
		createdById: v.id("users"),
		updatedAt: v.number(),
	})
		.index("by_blocking_task", ["blockingTaskId"])
		.index("by_blocked_and_blocking", ["blockedTaskId", "blockingTaskId"]),

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
		wcaCompetitionId: v.optional(v.string()),
		currentPhaseId: v.optional(v.id("phases")),
		updatedAt: v.number(),
	})
		.index("by_comp_start", ["compStart"])
		.index("by_name", ["name"])
		.index("by_current_phase", ["currentPhaseId"])
		.index("by_comp_sheet_id", ["compSheet.sheetId"])
		.index("by_wca_competition_id", ["wcaCompetitionId"]),

	sponsors: defineTable({
		name: v.string(),
		email: v.string(),
		emailNormalized: v.string(),
		avatarUrl: v.optional(v.string()),
		authUserId: v.optional(v.string()),
		lastAccessEmailSentAt: v.optional(v.number()),
		active: v.boolean(),
		createdById: v.id("users"),
		updatedById: v.id("users"),
		updatedAt: v.number(),
	})
		.index("by_email_normalized", ["emailNormalized"])
		.index("by_auth_user_id", ["authUserId"])
		.index("by_name", ["name"]),

	sponsorshipAuctions: defineTable({
		competitionId: v.id("competitions"),
		framework: sponsorshipAuctionFramework,
		state: sponsorshipAuctionState,
		currency: v.string(),
		startsAt: v.number(),
		endsAt: v.number(),
		antiSnipingWindowMs: v.number(),
		antiSnipingExtendMs: v.number(),
		startPriceCents: v.number(),
		currentPriceCents: v.optional(v.number()),
		currentLeaderSponsorId: v.optional(v.id("sponsors")),
		currentLeaderMaxCents: v.optional(v.number()),
		winnerSponsorId: v.optional(v.id("sponsors")),
		winningBidId: v.optional(v.id("sponsorshipBidIntents")),
		settlementAmountCents: v.optional(v.number()),
		readinessSnapshotJson: v.optional(v.string()),
		createdById: v.id("users"),
		updatedById: v.id("users"),
		updatedAt: v.number(),
	})
		.index("by_competition", ["competitionId"])
		.index("by_state_and_end", ["state", "endsAt"])
		.index("by_state_and_start", ["state", "startsAt"])
		.index("by_competition_and_state", ["competitionId", "state"]),

	sponsorshipAuctionInvites: defineTable({
		auctionId: v.id("sponsorshipAuctions"),
		sponsorId: v.id("sponsors"),
		invitedById: v.id("users"),
		invitedAt: v.number(),
		inviteSentAt: v.optional(v.number()),
	})
		.index("by_auction", ["auctionId"])
		.index("by_sponsor", ["sponsorId"])
		.index("by_auction_and_sponsor", ["auctionId", "sponsorId"]),

	sponsorshipBidIntents: defineTable({
		auctionId: v.id("sponsorshipAuctions"),
		sponsorId: v.id("sponsors"),
		mode: sponsorshipBidIntentMode,
		amountCents: v.number(),
		maxAmountCents: v.optional(v.number()),
		isValid: v.boolean(),
		createdAt: v.number(),
	})
		.index("by_auction", ["auctionId"])
		.index("by_auction_and_sponsor", ["auctionId", "sponsorId"])
		.index("by_auction_and_created_at", ["auctionId", "createdAt"]),

	sponsorshipBidEvents: defineTable({
		auctionId: v.id("sponsorshipAuctions"),
		sponsorId: v.optional(v.id("sponsors")),
		amountCents: v.number(),
		isAuto: v.boolean(),
		intentId: v.optional(v.id("sponsorshipBidIntents")),
		createdAt: v.number(),
	})
		.index("by_auction", ["auctionId"])
		.index("by_auction_and_created_at", ["auctionId", "createdAt"]),

	sponsorshipEmailDispatches: defineTable({
		auctionId: v.optional(v.id("sponsorshipAuctions")),
		sponsorId: v.optional(v.id("sponsors")),
		emailType: sponsorshipEmailType,
		recipient: v.string(),
		recipientName: v.optional(v.string()),
		subject: v.string(),
		message: v.string(),
		contextJson: v.optional(v.string()),
		idempotencyKey: v.string(),
		status: sponsorshipEmailDispatchStatus,
		attempts: v.number(),
		maxAttempts: v.number(),
		scheduledFor: v.optional(v.number()),
		scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
		claimKey: v.optional(v.string()),
		lastAttemptAt: v.optional(v.number()),
		providerOperationId: v.optional(v.string()),
		providerPollerState: v.optional(v.string()),
		sentAt: v.optional(v.number()),
		providerMessageId: v.optional(v.string()),
		error: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_auction", ["auctionId"])
		.index("by_sponsor", ["sponsorId"])
		.index("by_email_type", ["emailType"])
		.index("by_idempotency_key", ["idempotencyKey"])
		.index("by_status_and_scheduled_for", ["status", "scheduledFor"])
		.index("by_status_and_updated_at", ["status", "updatedAt"]),

	sponsorshipEmailDeadLetters: defineTable({
		dispatchId: v.id("sponsorshipEmailDispatches"),
		auctionId: v.optional(v.id("sponsorshipAuctions")),
		sponsorId: v.optional(v.id("sponsors")),
		emailType: sponsorshipEmailType,
		recipient: v.string(),
		subject: v.string(),
		error: v.string(),
		attempts: v.number(),
		payloadJson: v.optional(v.string()),
		failedAt: v.number(),
	})
		.index("by_auction", ["auctionId"])
		.index("by_sponsor", ["sponsorId"])
		.index("by_email_type", ["emailType"])
		.index("by_failed_at", ["failedAt"]),

	competitionAccess: defineTable({
		competitionId: v.id("competitions"),
		userId: v.id("users"),
	})
		.index("by_user", ["userId"])
		.index("by_competition", ["competitionId"])
		.index("by_user_and_competition", ["userId", "competitionId"]),

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

	notifications: defineTable({
		userId: v.id("users"),
		type: notificationType,
		priority: notificationPriority,
		status: v.union(
			v.literal("unread"),
			v.literal("read"),
			v.literal("archived"),
		),
		title: v.string(),
		message: v.string(),
		body: v.optional(v.string()),
		entityType: v.union(
			v.literal("task"),
			v.literal("comment"),
			v.literal("competition"),
			v.literal("reminder"),
		),
		entityId: v.string(),
		parentEntityId: v.optional(v.string()),
		metadata: notificationMetadata,
		sourceEventId: v.optional(v.id("notificationEvents")),
		threadKey: v.optional(v.string()),
		dedupeKey: v.optional(v.string()),
		readAt: v.optional(v.number()),
		archivedAt: v.optional(v.number()),
		snoozedUntil: v.optional(v.number()),
		scheduledFor: v.optional(v.number()),
		isBatchable: v.boolean(),
		batchKey: v.optional(v.string()),
	})
		.index("by_user", ["userId"])
		.index("by_user_and_status", ["userId", "status"])
		.index("by_user_source_event", ["userId", "sourceEventId"])
		.index("by_entity", ["entityType", "entityId"])
		.index("by_parent_entity", ["parentEntityId"]),

	notificationEvents: defineTable({
		type: notificationType,
		entityType: v.union(
			v.literal("task"),
			v.literal("comment"),
			v.literal("competition"),
			v.literal("reminder"),
		),
		entityId: v.string(),
		actorId: v.optional(v.id("users")),
		idempotencyKey: v.string(),
		threadKey: v.optional(v.string()),
		dedupeKey: v.optional(v.string()),
		payloadJson: v.optional(v.string()),
		createdAt: v.number(),
	})
		.index("by_idempotency_key", ["idempotencyKey"])
		.index("by_entity", ["entityType", "entityId"]),

	notificationPreferences: defineTable({
		userId: v.id("users"),
		type: notificationType,
		channel: notificationChannel,
		enabled: v.boolean(),
		digestMode: notificationDigestMode,
		respectQuietHours: v.optional(v.boolean()),
		updatedAt: v.number(),
	}).index("by_user_type_channel", ["userId", "type", "channel"]),

	notificationUserSettings: defineTable({
		userId: v.id("users"),
		timezone: v.string(),
		defaultDigestMode: v.optional(notificationDigestMode),
		quietHoursStartMin: v.optional(v.number()),
		quietHoursEndMin: v.optional(v.number()),
		updatedAt: v.number(),
	}).index("by_user", ["userId"]),

	notificationSubscriptions: defineTable({
		userId: v.id("users"),
		entityType: notificationSubscriberEntityType,
		entityId: v.string(),
		updatedAt: v.number(),
	})
		.index("by_user_entity", ["userId", "entityType", "entityId"])
		.index("by_user_updated_at", ["userId", "updatedAt"])
		.index("by_entity", ["entityType", "entityId"]),

	notificationDispatches: defineTable({
		eventId: v.id("notificationEvents"),
		notificationId: v.optional(v.id("notifications")),
		userId: v.id("users"),
		channel: notificationChannel,
		digestMode: notificationDigestMode,
		scheduledFor: v.optional(v.number()),
		scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
		digestWindowKey: v.optional(v.string()),
		status: notificationDispatchStatus,
		reason: v.optional(v.string()),
		metadataJson: v.optional(v.string()),
		attempts: v.number(),
		maxAttempts: v.number(),
		lastAttemptAt: v.optional(v.number()),
		sentAt: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_event_user_channel", ["eventId", "userId", "channel"])
		.index("by_event", ["eventId"])
		.index("by_notification", ["notificationId"])
		.index("by_user_status", ["userId", "status"])
		.index("by_user_channel_mode_window_status", [
			"userId",
			"channel",
			"digestMode",
			"digestWindowKey",
			"status",
		])
		.index("by_channel_status", ["channel", "status"]),

	notificationDeadLetters: defineTable({
		dispatchId: v.id("notificationDispatches"),
		eventId: v.id("notificationEvents"),
		userId: v.id("users"),
		channel: notificationChannel,
		error: v.string(),
		attempts: v.number(),
		payloadJson: v.optional(v.string()),
		failedAt: v.number(),
	})
		.index("by_failed_at", ["failedAt"])
		.index("by_channel_failed_at", ["channel", "failedAt"]),

	reminders: defineTable({
		userId: v.id("users"),
		entityType: v.literal("task"),
		entityId: v.id("tasks"),
		type: v.union(v.literal("one_time"), v.literal("recurring")),
		remindAt: v.number(),
		scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
		recurringPattern: v.optional(v.string()),
		recurringConfig: reminderRecurringConfig,
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
		metadata: reminderMetadata,
		updatedAt: v.number(),
	})
		.index("by_user_and_status", ["userId", "status"])
		.index("by_user_entityId_status", ["userId", "entityId", "status"])
		.index("by_entity", ["entityType", "entityId"]),

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
	}).index("by_user_entity_page", ["userId", "entity", "pageId"]),

	weekendOverrides: defineTable({
		satDate: v.string(),
		eventNote: v.optional(v.string()),
		reserved: v.optional(v.boolean()),
		announced: v.optional(v.boolean()),
		updatedAt: v.number(),
	}).index("by_sat_date", ["satDate"]),

	googleSheetsTokens: defineTable({
		accessToken: v.string(),
		refreshToken: v.string(),
		expiresAt: v.number(),
		updatedAt: v.number(),
	}),

	wcaTokens: defineTable({
		accessToken: v.string(),
		refreshToken: v.string(),
		expiresAt: v.number(),
		updatedAt: v.number(),
	}),

	sheetScheduleCache: defineTable({
		sheetId: v.string(),
		events: v.array(
			v.object({
				eventName: v.string(),
				rounds: v.string(),
			}),
		),
		fetchedAt: v.number(),
	}).index("by_sheet_id", ["sheetId"]),
});
