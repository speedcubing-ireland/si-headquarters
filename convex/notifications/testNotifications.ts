import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { requireUserId } from "../core/auth";
import { emitNotificationEvent } from ".";

type TestTaskSeed = {
	task: Doc<"tasks">;
	blocker: Doc<"tasks">;
	comment: Doc<"comments">;
	reply: Doc<"comments">;
};

async function ensureTestActor(ctx: MutationCtx): Promise<Id<"users">> {
	const existing = await ctx.db
		.query("users")
		.withIndex("email", (q) => q.eq("email", "notifications-test@hq.local"))
		.unique();
	if (existing) return existing._id;
	return await ctx.db.insert("users", {
		name: "Sean O'Toole",
		email: "notifications-test@hq.local",
		discordAvatarUrl:
			"https://cdn.discordapp.com/avatars/593915321660735511/8d7a1e962e55995034fde19cfa70a6ec.png",
	});
}

async function seedCompetition(
	ctx: MutationCtx,
	userId: Id<"users">,
	actorId: Id<"users">,
): Promise<Doc<"competitions">> {
	const now = Date.now();
	const competitionId = await ctx.db.insert("competitions", {
		name: "Can't See Tralee 2026",
		description: "Notification test competition",
		compStart: "2026-07-18",
		compEnd: "2026-07-19",
		compLeadId: userId,
		leadDelegateId: actorId,
		organiserIds: [userId],
		updatedAt: now,
	});
	await ctx.db.insert("competitionAccess", { competitionId, userId });
	const competition = await ctx.db.get("competitions", competitionId);
	if (!competition) {
		throw new ConvexError("Failed to seed notification test competition.");
	}
	return competition;
}

async function seedTask(
	ctx: MutationCtx,
	args: {
		identifier: string;
		title: string;
		status: Doc<"tasks">["status"];
		priority: Doc<"tasks">["priority"];
		competitionId: Id<"competitions">;
		userId: Id<"users">;
		actorId: Id<"users">;
		dueDate?: string;
		parentTaskId?: Id<"tasks">;
	},
): Promise<Doc<"tasks">> {
	const taskId = await ctx.db.insert("tasks", {
		identifier: args.identifier,
		title: args.title,
		description: "Seeded by the realistic notification test sender.",
		status: args.status,
		priority: args.priority,
		dueDate: args.dueDate,
		archived: false,
		parentTaskId: args.parentTaskId,
		parentCompetitionId: args.competitionId,
		ownerId: args.userId,
		ownerType: "user",
		assigneeId: args.userId,
		labelIds: [],
		requiredApprovalIds: [`user:${args.userId}`],
		approvedByIds: [args.actorId],
		updatedAt: Date.now(),
	});
	const task = await ctx.db.get("tasks", taskId);
	if (!task) {
		throw new ConvexError("Failed to seed notification test task.");
	}
	return task;
}

async function seedTaskScenario(
	ctx: MutationCtx,
	userId: Id<"users">,
	actorId: Id<"users">,
	competitionId: Id<"competitions">,
): Promise<TestTaskSeed> {
	const blocker = await seedTask(ctx, {
		identifier: "HQ-123",
		title: "Complete competition groups",
		status: "done",
		priority: "high",
		competitionId,
		userId,
		actorId,
		dueDate: "2026-05-15",
	});
	const task = await seedTask(ctx, {
		identifier: "HQ-227",
		title: "Waiting list emailed and refunded",
		status: "awaiting-review",
		priority: "urgent",
		competitionId,
		userId,
		actorId,
		dueDate: "2026-05-24",
	});
	const commentId = await ctx.db.insert("comments", {
		parentType: "task",
		parentId: `${task._id}`,
		authorId: actorId,
		content: "Can you confirm the refund batch has gone out?",
		reactions: [],
		updatedAt: Date.now(),
	});
	const replyId = await ctx.db.insert("comments", {
		parentType: "task",
		parentId: `${task._id}`,
		parentCommentId: commentId,
		authorId: actorId,
		content: "Yes, refunds are included in the same batch.",
		reactions: [],
		updatedAt: Date.now(),
	});
	const [comment, reply] = await Promise.all([
		ctx.db.get("comments", commentId),
		ctx.db.get("comments", replyId),
	]);
	if (!comment || !reply) {
		throw new ConvexError("Failed to seed notification test comments.");
	}
	return { task, blocker, comment, reply };
}

async function emitTestNotification(
	label: string,
	emit: () => Promise<unknown>,
): Promise<string> {
	try {
		await emit();
		return `${label}: sent`;
	} catch (error) {
		return `${label}: failed - ${
			error instanceof Error ? error.message : String(error)
		}`;
	}
}

export const sendAllTestNotifications = mutation({
	args: {},
	returns: v.array(v.string()),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);

		const discordLink = await ctx.runQuery(
			api.discord.api.getCurrentUserSettings,
			{},
		);

		if (!discordLink.link) {
			return [
				"Skipped: No Discord account linked. Link your Discord account in settings first.",
			];
		}

		const actorId = await ensureTestActor(ctx);
		const competition = await seedCompetition(ctx, userId, actorId);
		const { task, blocker, comment, reply } = await seedTaskScenario(
			ctx,
			userId,
			actorId,
			competition._id,
		);
		const updateId = await ctx.db.insert("competitionUpdates", {
			competitionId: competition._id,
			authorId: actorId,
			status: "on-track",
			message: "The competition is almost ready!",
			reactions: [],
			updatedAt: Date.now(),
		});
		const reminderId = await ctx.db.insert("reminders", {
			userId,
			entityType: "task",
			entityId: task._id,
			type: "one_time",
			remindAt: Date.now() - 60_000,
			status: "triggered",
			triggeredAt: Date.now(),
			message:
				"Refund reconciliation needs a final check before the finance call.",
			priority: "normal",
			metadata: {},
			updatedAt: Date.now(),
		});

		return await Promise.all([
			emitTestNotification("task_assigned", () =>
				emitNotificationEvent(ctx, {
					type: "task_assigned",
					taskId: task._id,
					recipientId: userId,
					actorId,
					eventKey: `test:task_assigned:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("task_unassigned", () =>
				emitNotificationEvent(ctx, {
					type: "task_unassigned",
					taskId: task._id,
					recipientId: userId,
					actorId,
					eventKey: `test:task_unassigned:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("task_mentioned", () =>
				emitNotificationEvent(ctx, {
					type: "task_mentioned",
					taskId: task._id,
					commentId: comment._id,
					recipientId: userId,
					actorId,
					eventKey: `test:task_mentioned:${Date.now()}`,
				}),
			),
			emitTestNotification("task_status_changed", () =>
				emitNotificationEvent(ctx, {
					type: "task_status_changed",
					taskId: task._id,
					recipientId: userId,
					actorId,
					oldStatus: "in-progress",
					newStatus: "awaiting-review",
					eventKey: `test:task_status_changed:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("task_priority_changed", () =>
				emitNotificationEvent(ctx, {
					type: "task_priority_changed",
					taskId: task._id,
					recipientId: userId,
					actorId,
					oldPriority: "medium",
					newPriority: "urgent",
					eventKey: `test:task_priority_changed:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("task_awaiting_review", () =>
				emitNotificationEvent(ctx, {
					type: "task_awaiting_review",
					taskId: task._id,
					recipientId: userId,
					actorId,
					eventKey: `test:task_awaiting_review:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("due_date_approaching", () =>
				emitNotificationEvent(ctx, {
					type: "due_date_approaching",
					taskId: task._id,
					assigneeId: userId,
					daysUntil: 0,
					eventKey: `test:due_date_approaching:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("due_date_overdue", () =>
				emitNotificationEvent(ctx, {
					type: "due_date_overdue",
					taskId: blocker._id,
					assigneeId: userId,
					daysOverdue: 2,
					eventKey: `test:due_date_overdue:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("comment_added", () =>
				emitNotificationEvent(ctx, {
					type: "comment_added",
					taskId: task._id,
					commentId: comment._id,
					recipientId: userId,
					actorId,
					eventKey: `test:comment_added:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("comment_replied", () =>
				emitNotificationEvent(ctx, {
					type: "comment_replied",
					taskId: task._id,
					commentId: reply._id,
					recipientId: userId,
					actorId,
					eventKey: `test:comment_replied:${Date.now()}`,
				}),
			),
			emitTestNotification("relation_blocked", () =>
				emitNotificationEvent(ctx, {
					type: "relation_blocked",
					taskId: task._id,
					blockingTaskId: blocker._id,
					recipientId: userId,
					actorId,
					eventKey: `test:relation_blocked:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("relation_unblocked", () =>
				emitNotificationEvent(ctx, {
					type: "relation_unblocked",
					taskId: task._id,
					blockingTaskId: blocker._id,
					recipientId: userId,
					actorId,
					eventKey: `test:relation_unblocked:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("task_approved", () =>
				emitNotificationEvent(ctx, {
					type: "task_approved",
					taskId: task._id,
					recipientId: userId,
					actorId,
					eventKey: `test:task_approved:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("task_unapproved", () =>
				emitNotificationEvent(ctx, {
					type: "task_unapproved",
					taskId: task._id,
					recipientId: userId,
					actorId,
					eventKey: `test:task_unapproved:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("due_date_changed", () =>
				emitNotificationEvent(ctx, {
					type: "due_date_changed",
					taskId: task._id,
					recipientId: userId,
					actorId,
					oldDueDate: "2026-05-20",
					newDueDate: "2026-05-24",
					eventKey: `test:due_date_changed:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("competition_phase_changed", () =>
				emitNotificationEvent(ctx, {
					type: "competition_phase_changed",
					competitionId: competition._id,
					recipientId: userId,
					actorId,
					oldPhaseName: "Registration Setup",
					newPhaseName: "Ready to Announce",
					eventKey: `test:competition_phase_changed:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("progress_update_added", () =>
				emitNotificationEvent(ctx, {
					type: "progress_update_added",
					competitionId: competition._id,
					updateId,
					recipientId: userId,
					actorId,
					competitionName: competition.name,
					status: "on-track",
					eventKey: `test:progress_update_added:${Date.now()}`,
					forceRecipientDelivery: true,
				}),
			),
			emitTestNotification("reminder_triggered", () =>
				emitNotificationEvent(ctx, {
					type: "reminder_triggered",
					reminderId,
					userId,
					taskId: task._id,
					message:
						"Refund reconciliation needs a final check before the finance call.",
					eventKey: `test:reminder_triggered:${Date.now()}`,
				}),
			),
		]);
	},
});
