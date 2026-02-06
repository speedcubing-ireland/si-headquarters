import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUserId } from "./auth";
import { internal } from "./_generated/api";
import { REMINDER_PATTERNS } from "./lib/constants";
import {
	reminderStatus,
	reminderType,
	reminderMetadata,
	reminderRecurringConfig,
} from "./lib/validators";

const DAYS_PER_WEEK = 7;
const PRIORITY_NORMAL = "normal";

const toISO = (ms: number) => new Date(ms).toISOString();

export const reminderReturns = v.object({
	id: v.id("reminders"),
	userId: v.id("users"),
	entityType: v.literal("task"),
	entityId: v.id("tasks"),
	type: reminderType,
	remindAt: v.string(),
	recurringPattern: v.optional(v.string()),
	recurringConfig: reminderRecurringConfig,
	endDate: v.optional(v.string()),
	status: reminderStatus,
	triggeredAt: v.optional(v.string()),
	dismissedAt: v.optional(v.string()),
	message: v.optional(v.string()),
	priority: v.string(),
	metadata: reminderMetadata,
	createdAt: v.string(),
	updatedAt: v.string(),
});

function docToReminder(d: Doc<"reminders">) {
	return {
		id: d._id,
		userId: d.userId,
		entityType: d.entityType,
		entityId: d.entityId,
		type: d.type,
		remindAt: toISO(d.remindAt),
		recurringPattern: d.recurringPattern,
		recurringConfig: d.recurringConfig,
		endDate: d.endDate,
		status: d.status,
		triggeredAt: d.triggeredAt !== undefined ? toISO(d.triggeredAt) : undefined,
		dismissedAt: d.dismissedAt !== undefined ? toISO(d.dismissedAt) : undefined,
		message: d.message,
		priority: d.priority,
		metadata: d.metadata ?? {},
		createdAt: toISO(d._creationTime),
		updatedAt: toISO(d.updatedAt),
	};
}

export const listForUser = query({
	args: {},
	returns: v.array(reminderReturns),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const docs = await ctx.db
			.query("reminders")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.order("desc")
			.collect();
		return docs.map(docToReminder);
	},
});

export const listPendingForUser = query({
	args: {},
	returns: v.array(reminderReturns),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const docs = await ctx.db
			.query("reminders")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", userId).eq("status", "pending"),
			)
			.order("asc")
			.collect();
		return docs.map(docToReminder);
	},
});

export const listPendingForTask = query({
	args: { taskId: v.id("tasks") },
	returns: v.array(reminderReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const docs = await ctx.db
			.query("reminders")
			.withIndex("by_user_entityId_status", (q) =>
				q
					.eq("userId", userId)
					.eq("entityId", args.taskId)
					.eq("status", "pending"),
			)
			.order("asc")
			.collect();
		return docs.map(docToReminder);
	},
});

export const create = mutation({
	args: {
		entityId: v.id("tasks"),
		type: v.union(v.literal("one_time"), v.literal("recurring")),
		remindAt: v.string(),
		recurringPattern: v.optional(v.string()),
		recurringConfig: reminderRecurringConfig,
		endDate: v.optional(v.string()),
		message: v.optional(v.string()),
		priority: v.optional(v.string()),
		metadata: reminderMetadata,
	},
	returns: v.id("reminders"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		const remindAtMs = new Date(args.remindAt).getTime();
		return await ctx.db.insert("reminders", {
			userId,
			entityType: "task",
			entityId: args.entityId,
			type: args.type,
			remindAt: remindAtMs,
			recurringPattern: args.recurringPattern,
			recurringConfig: args.recurringConfig,
			endDate: args.endDate,
			status: "pending",
			priority: args.priority ?? PRIORITY_NORMAL,
			message: args.message,
			metadata: args.metadata,
			updatedAt: now,
		});
	},
});

export const cancel = mutation({
	args: { reminderId: v.id("reminders") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("reminders", args.reminderId);
		if (!doc || doc.userId !== userId) return null;
		await ctx.db.delete("reminders", args.reminderId);
		return null;
	},
});

export const dismiss = mutation({
	args: { reminderId: v.id("reminders") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("reminders", args.reminderId);
		if (!doc || doc.userId !== userId || doc.status !== "triggered")
			return null;
		await ctx.db.patch("reminders", args.reminderId, {
			status: "dismissed",
			dismissedAt: Date.now(),
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const snooze = mutation({
	args: {
		reminderId: v.id("reminders"),
		snoozeUntil: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("reminders", args.reminderId);
		if (!doc || doc.userId !== userId) return null;
		const remindAtMs = new Date(args.snoozeUntil).getTime();
		await ctx.db.patch("reminders", args.reminderId, {
			status: "pending",
			remindAt: remindAtMs,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const reschedule = mutation({
	args: {
		reminderId: v.id("reminders"),
		remindAt: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("reminders", args.reminderId);
		if (!doc || doc.userId !== userId) return null;
		const remindAtMs = new Date(args.remindAt).getTime();
		await ctx.db.patch("reminders", args.reminderId, {
			remindAt: remindAtMs,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const _checkPendingReminders = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const now = Date.now();
		const pendingDue = await ctx.db
			.query("reminders")
			.withIndex("by_status_and_remind_at", (q) =>
				q.eq("status", "pending").lte("remindAt", now),
			)
			.collect();

		let triggeredCount = 0;
		for (const reminder of pendingDue) {
			await ctx.db.patch("reminders", reminder._id, {
				status: "triggered",
				triggeredAt: now,
				updatedAt: now,
			});
			await ctx.scheduler.runAfter(
				0,
				internal.notifications._notifyReminderTriggered,
				{
					reminderId: reminder._id,
					userId: reminder.userId,
					taskId: reminder.entityId,
					message: reminder.message,
				},
			);
			triggeredCount++;

			if (reminder.type === "recurring" && reminder.recurringPattern) {
				const nextRemindAt = calculateNextReminderTime(
					reminder.remindAt,
					reminder.recurringPattern,
				);
				const beforeEnd =
					!reminder.endDate ||
					new Date(reminder.endDate).getTime() > nextRemindAt;
				if (beforeEnd) {
					await ctx.db.insert("reminders", {
						userId: reminder.userId,
						entityType: reminder.entityType,
						entityId: reminder.entityId,
						type: reminder.type,
						remindAt: nextRemindAt,
						recurringPattern: reminder.recurringPattern,
						recurringConfig: reminder.recurringConfig,
						endDate: reminder.endDate,
						status: "pending",
						priority: reminder.priority,
						message: reminder.message,
						metadata: reminder.metadata,
						updatedAt: now,
					});
				}
			}
		}

		return triggeredCount;
	},
});

function calculateNextReminderTime(
	currentRemindAt: number,
	pattern: string,
): number {
	const nextDate = new Date(currentRemindAt);

	if (pattern === REMINDER_PATTERNS.DAILY) {
		nextDate.setDate(nextDate.getDate() + 1);
	} else if (pattern === REMINDER_PATTERNS.WEEKLY) {
		nextDate.setDate(nextDate.getDate() + DAYS_PER_WEEK);
	} else if (pattern === REMINDER_PATTERNS.MONTHLY) {
		nextDate.setMonth(nextDate.getMonth() + 1);
	} else {
		nextDate.setDate(nextDate.getDate() + 1);
	}

	return nextDate.getTime();
}
