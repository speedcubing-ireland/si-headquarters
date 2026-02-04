import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./auth";

const toISO = (ms: number) => new Date(ms).toISOString();

const reminderReturns = v.object({
	id: v.string(),
	userId: v.string(),
	entityType: v.literal("task"),
	entityId: v.string(),
	type: v.union(v.literal("one_time"), v.literal("recurring")),
	remindAt: v.string(),
	recurringPattern: v.optional(v.string()),
	recurringConfig: v.optional(v.any()),
	endDate: v.optional(v.string()),
	status: v.union(
		v.literal("pending"),
		v.literal("triggered"),
		v.literal("dismissed"),
		v.literal("completed"),
	),
	triggeredAt: v.optional(v.string()),
	dismissedAt: v.optional(v.string()),
	message: v.optional(v.string()),
	priority: v.string(),
	metadata: v.optional(v.any()),
	createdAt: v.string(),
	updatedAt: v.string(),
});

function docToReminder(d: {
	_id: Id<"reminders">;
	_creationTime: number;
	userId: Id<"users">;
	entityType: "task";
	entityId: string;
	type: "one_time" | "recurring";
	remindAt: number;
	recurringPattern?: string;
	recurringConfig?: unknown;
	endDate?: string;
	status: "pending" | "triggered" | "dismissed" | "completed";
	triggeredAt?: number;
	dismissedAt?: number;
	message?: string;
	priority: string;
	metadata?: unknown;
	updatedAt: number;
}) {
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
	args: { userId: v.id("users") },
	returns: v.array(reminderReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		if (args.userId !== userId) {
			return [];
		}
		const docs = await ctx.db
			.query("reminders")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.collect();
		return docs.map(docToReminder);
	},
});

export const listPendingForUser = query({
	args: { userId: v.id("users") },
	returns: v.array(reminderReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		if (args.userId !== userId) {
			return [];
		}
		const docs = await ctx.db
			.query("reminders")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", args.userId).eq("status", "pending"),
			)
			.order("asc")
			.collect();
		return docs.map(docToReminder);
	},
});

export const create = mutation({
	args: {
		userId: v.id("users"),
		entityId: v.string(),
		type: v.union(v.literal("one_time"), v.literal("recurring")),
		remindAt: v.string(),
		recurringPattern: v.optional(v.string()),
		recurringConfig: v.optional(v.any()),
		endDate: v.optional(v.string()),
		message: v.optional(v.string()),
		priority: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	returns: v.id("reminders"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		if (args.userId !== userId) {
			// Do not allow creating reminders for other users.
			throw new Error("Cannot create reminder for another user");
		}
		const now = Date.now();
		const remindAtMs =
			typeof args.remindAt === "string"
				? new Date(args.remindAt).getTime()
				: now;
		return await ctx.db.insert("reminders", {
			userId: args.userId,
			entityType: "task",
			entityId: args.entityId,
			type: args.type,
			remindAt: remindAtMs,
			recurringPattern: args.recurringPattern,
			recurringConfig: args.recurringConfig,
			endDate: args.endDate,
			status: "pending",
			priority: args.priority ?? "normal",
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
