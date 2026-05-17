import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
	taskStatus,
	taskPriority,
	reminderMetadata,
	reminderRecurringConfig,
	linkedActionType,
	linkedActionRunPermission,
	linkedActionConfig,
	linkedTaskActionStatus,
} from "./lib/validators";
import {
	notificationType,
	notificationSubscriberEntityType,
} from "./notifications/lib/validators";
import {
	competitionSponsorPropertyStatus,
	sponsorshipAuctionFramework,
	auctionState,
	sponsorshipBidIntentMode,
} from "./sponsorship/lib/validators";
import { competitionSnapshot } from "./sponsorship/lib/competitionSnapshot";
import { emailDispatchStatus, emailSourceKind } from "./emailQueue/types";

export default defineSchema({
	...authTables,
	users: defineTable({
		name: v.optional(v.string()),
		image: v.optional(v.string()),
		email: v.optional(v.string()),
		emailVerificationTime: v.optional(v.number()),
		phone: v.optional(v.string()),
		phoneVerificationTime: v.optional(v.number()),
		isAnonymous: v.optional(v.boolean()),
		discordAvatarUrl: v.optional(v.string()),
	})
		.index("email", ["email"])
		.index("phone", ["phone"]),
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

	refundVolunteers: defineTable({
		name: v.string(),
		wcaId: v.optional(v.string()),
		transferToWcaIds: v.optional(v.array(v.string())),
		archived: v.boolean(),
	})
		.index("by_wca_id", ["wcaId"])
		.index("by_archived_name", ["archived", "name"]),

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

	adminImpersonationTickets: defineTable({
		tokenHash: v.string(),
		targetType: v.union(v.literal("user"), v.literal("sponsor")),
		userId: v.optional(v.id("users")),
		sponsorId: v.optional(v.id("sponsors")),
		sponsorAuthUserId: v.optional(v.string()),
		createdById: v.id("users"),
		createdAt: v.number(),
		expiresAt: v.number(),
		usedAt: v.optional(v.number()),
		consumedByNonceHash: v.optional(v.string()),
	})
		.index("by_token_hash", ["tokenHash"])
		.index("by_expires_at", ["expiresAt"]),

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

	linkedActionDefinitions: defineTable({
		name: v.string(),
		shortId: v.string(),
		type: linkedActionType,
		runPermission: linkedActionRunPermission,
		config: linkedActionConfig,
		archived: v.boolean(),
		createdById: v.id("users"),
		updatedById: v.id("users"),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_short_id", ["shortId"])
		.index("by_archived", ["archived"])
		.index("by_type", ["type"]),

	taskLinkedActions: defineTable({
		taskId: v.id("tasks"),
		linkedActionId: v.id("linkedActionDefinitions"),
		status: linkedTaskActionStatus,
		lastRunAt: v.optional(v.number()),
		lastRunMessage: v.optional(v.string()),
		lastOutputJson: v.optional(v.string()),
		createdById: v.id("users"),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_task", ["taskId"])
		.index("by_linked_action", ["linkedActionId"])
		.index("by_task_and_linked_action", ["taskId", "linkedActionId"]),

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
		discordChannel: v.optional(
			v.object({
				guildId: v.string(),
				channelId: v.string(),
				channelName: v.string(),
				notificationTypeOverrides: v.optional(v.array(notificationType)),
			}),
		),
		manualSponsorPropertyStatus: v.optional(competitionSponsorPropertyStatus),
		manualSponsorId: v.optional(v.id("sponsors")),
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
		state: auctionState,
		currency: v.string(),
		startsAt: v.number(),
		endsAt: v.number(),
		activationScheduledFunctionId: v.optional(v.id("_scheduled_functions")),
		closureScheduledFunctionId: v.optional(v.id("_scheduled_functions")),
		antiSnipingWindowMs: v.number(),
		antiSnipingExtendMs: v.number(),
		startPriceCents: v.number(),
		currentPriceCents: v.optional(v.number()),
		currentLeaderSponsorId: v.optional(v.id("sponsors")),
		currentLeaderMaxCents: v.optional(v.number()),
		winnerSponsorId: v.optional(v.id("sponsors")),
		winningBidId: v.optional(v.id("sponsorshipBidIntents")),
		settlementAmountCents: v.optional(v.number()),
		competitionSnapshot: v.optional(competitionSnapshot),
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

	sponsorshipAuctionReminders: defineTable({
		auctionId: v.id("sponsorshipAuctions"),
		sponsorId: v.id("sponsors"),
		scheduledFor: v.number(),
		sent: v.boolean(),
		sentAt: v.optional(v.number()),
		scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
	})
		.index("by_sent_and_scheduled", ["sent", "scheduledFor"])
		.index("by_auction", ["auctionId"])
		.index("by_auction_and_sponsor", ["auctionId", "sponsorId"]),

	sponsorshipAuctionOutbidNotices: defineTable({
		auctionId: v.id("sponsorshipAuctions"),
		sponsorId: v.id("sponsors"),
		sentAt: v.number(),
	}).index("by_auction_and_sponsor", ["auctionId", "sponsorId"]),

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

	emailDispatches: defineTable({
		dedupeKey: v.string(),
		sourceKind: emailSourceKind,
		sourceRef: v.optional(v.string()),
		templateKey: v.string(),
		recipientEmail: v.string(),
		recipientName: v.optional(v.string()),
		senderAddress: v.optional(v.string()),
		subject: v.string(),
		htmlBody: v.optional(v.string()),
		plainTextBody: v.string(),
		payloadJson: v.optional(v.string()),
		scheduledFor: v.number(),
		status: emailDispatchStatus,
		claimKey: v.optional(v.string()),
		providerOperationId: v.string(),
		providerOperationClaimKey: v.optional(v.string()),
		providerStatus: v.optional(v.string()),
		providerPollerState: v.optional(v.string()),
		sendAttemptCount: v.number(),
		pollAttemptCount: v.number(),
		lastProviderCheckAt: v.optional(v.number()),
		submittedAt: v.optional(v.number()),
		deliveredAt: v.optional(v.number()),
		sentAt: v.optional(v.number()),
		error: v.optional(v.string()),
		deadLetteredAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_dedupe_key", ["dedupeKey"])
		.index("by_provider_operation_id", ["providerOperationId"])
		.index("by_status_scheduled_for", ["status", "scheduledFor"])
		.index("by_status_updated_at", ["status", "updatedAt"])
		.index("by_source_status_created_at", [
			"sourceKind",
			"status",
			"createdAt",
		]),

	emailDeadLetters: defineTable({
		dispatchId: v.id("emailDispatches"),
		dedupeKey: v.string(),
		sourceKind: emailSourceKind,
		sourceRef: v.optional(v.string()),
		templateKey: v.string(),
		recipientEmail: v.string(),
		subject: v.string(),
		error: v.string(),
		providerOperationId: v.string(),
		providerStatus: v.optional(v.string()),
		payloadJson: v.optional(v.string()),
		sendAttemptCount: v.number(),
		pollAttemptCount: v.number(),
		failedAt: v.number(),
		replayCount: v.number(),
	})
		.index("by_failed_at", ["failedAt"])
		.index("by_source_and_failed_at", ["sourceKind", "failedAt"])
		.index("by_dispatch", ["dispatchId"]),

	emailDispatchCounters: defineTable({
		sourceKind: emailSourceKind,
		status: emailDispatchStatus,
		count: v.number(),
		updatedAt: v.number(),
	}).index("by_source_and_status", ["sourceKind", "status"]),

	emailDeadLetterHourlyCounts: defineTable({
		hourStart: v.number(), // ms epoch aligned to hour boundary
		count: v.number(),
		updatedAt: v.number(),
	}).index("by_hour_start", ["hourStart"]),

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

	notificationSubscriptions: defineTable({
		userId: v.id("users"),
		entityType: notificationSubscriberEntityType,
		entityId: v.string(),
		updatedAt: v.number(),
	})
		.index("by_user_entity", ["userId", "entityType", "entityId"])
		.index("by_user_updated_at", ["userId", "updatedAt"])
		.index("by_entity", ["entityType", "entityId"]),

	discordUserLinks: defineTable({
		userId: v.id("users"),
		guildId: v.string(),
		discordUserId: v.string(),
		discordUsername: v.string(),
		discordDisplayName: v.optional(v.string()),
		discordAvatarUrl: v.optional(v.string()),
		linkedById: v.id("users"),
		linkedAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_discord_user", ["discordUserId"])
		.index("by_guild_and_discord_user", ["guildId", "discordUserId"]),

	discordNotificationUserSettings: defineTable({
		userId: v.id("users"),
		dmEnabled: v.boolean(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"]),

	discordNotificationPreferences: defineTable({
		userId: v.id("users"),
		type: notificationType,
		enabled: v.boolean(),
		updatedAt: v.number(),
	}).index("by_user_and_type", ["userId", "type"]),

	discordChannelDefaults: defineTable({
		notificationTypes: v.array(notificationType),
		updatedAt: v.number(),
	}),

	discordActionTokens: defineTable({
		token: v.string(),
		actionKind: v.union(
			v.literal("dismiss_message"),
			v.literal("set_task_status"),
			v.literal("approve_task"),
			v.literal("unapprove_task"),
			v.literal("open_task_comment_modal"),
			v.literal("open_task_reply_modal"),
			v.literal("open_update_comment_modal"),
		),
		userId: v.optional(v.id("users")),
		taskId: v.optional(v.id("tasks")),
		commentId: v.optional(v.id("comments")),
		updateId: v.optional(v.id("competitionUpdates")),
		reminderId: v.optional(v.id("reminders")),
		status: v.optional(taskStatus),
		messageId: v.optional(v.string()),
		channelId: v.optional(v.string()),
		expiresAt: v.number(),
		consumedAt: v.optional(v.number()),
		createdAt: v.number(),
	}).index("by_token", ["token"]),

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

	userThemeSettings: defineTable({
		userId: v.id("users"),
		themeJson: v.string(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"]),

	weekendOverrides: defineTable({
		satDate: v.string(),
		eventNote: v.optional(v.string()),
		reserved: v.optional(v.boolean()),
		announced: v.optional(v.boolean()),
		updatedAt: v.number(),
	}).index("by_sat_date", ["satDate"]),

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

	serviceTokens: defineTable({
		service: v.union(v.literal("google"), v.literal("wca"), v.literal("canva")),
		accessToken: v.string(),
		refreshToken: v.string(),
		expiresAt: v.number(),
		updatedAt: v.number(),
	}).index("by_service", ["service"]),
});
