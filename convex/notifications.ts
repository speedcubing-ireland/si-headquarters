import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./auth";

const toISO = (ms: number) => new Date(ms).toISOString();

const notificationReturns = v.object({
	id: v.string(),
	userId: v.string(),
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
	createdAt: v.string(),
	readAt: v.optional(v.string()),
	archivedAt: v.optional(v.string()),
	scheduledFor: v.optional(v.string()),
	isBatchable: v.boolean(),
	batchKey: v.optional(v.string()),
});

function docToNotification(d: {
	_id: Id<"notifications">;
	_creationTime: number;
	userId: Id<"users">;
	type: string;
	priority: string;
	status: "unread" | "read" | "archived";
	title: string;
	message: string;
	body?: string;
	entityType: string;
	entityId: string;
	parentEntityId?: string;
	metadata?: unknown;
	readAt?: number;
	archivedAt?: number;
	scheduledFor?: number;
	isBatchable: boolean;
	batchKey?: string;
}) {
	return {
		id: d._id,
		userId: d.userId,
		type: d.type,
		priority: d.priority,
		status: d.status,
		title: d.title,
		message: d.message,
		body: d.body,
		entityType: d.entityType,
		entityId: d.entityId,
		parentEntityId: d.parentEntityId,
		metadata: d.metadata ?? {},
		createdAt: toISO(d._creationTime),
		readAt: d.readAt !== undefined ? toISO(d.readAt) : undefined,
		archivedAt: d.archivedAt !== undefined ? toISO(d.archivedAt) : undefined,
		scheduledFor:
			d.scheduledFor !== undefined ? toISO(d.scheduledFor) : undefined,
		isBatchable: d.isBatchable,
		batchKey: d.batchKey,
	};
}

export const listForUser = query({
	args: { userId: v.id("users") },
	returns: v.array(notificationReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		// Enforce that callers can only fetch their own notifications.
		if (args.userId !== userId) {
			return [];
		}
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.collect();
		return docs.map(docToNotification);
	},
});

export const getUnreadCount = query({
	args: { userId: v.id("users") },
	returns: v.number(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		if (args.userId !== userId) {
			return 0;
		}
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", args.userId).eq("status", "unread"),
			)
			.collect();
		return docs.length;
	},
});

export const markRead = mutation({
	args: { notificationId: v.id("notifications") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId || doc.status !== "unread") return null;
		await ctx.db.patch("notifications", args.notificationId, {
			status: "read",
			readAt: Date.now(),
		});
		return null;
	},
});

export const markArchived = mutation({
	args: { notificationId: v.id("notifications") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId) return null;
		await ctx.db.patch("notifications", args.notificationId, {
			status: "archived",
			archivedAt: Date.now(),
			readAt: doc.readAt ?? Date.now(),
		});
		return null;
	},
});

export const markAllRead = mutation({
	args: { userId: v.id("users") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		if (args.userId !== userId) return null;
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", args.userId).eq("status", "unread"),
			)
			.collect();
		const now = Date.now();
		await Promise.all(
			docs.map((d) =>
				ctx.db.patch("notifications", d._id, {
					status: "read",
					readAt: now,
				}),
			),
		);
		return null;
	},
});

export const dismiss = mutation({
	args: { notificationId: v.id("notifications") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId) return null;
		const now = Date.now();
		await ctx.db.patch("notifications", args.notificationId, {
			status: "archived",
			readAt: doc.readAt ?? now,
			archivedAt: now,
		});
		return null;
	},
});

export const create = mutation({
	args: {
		userId: v.id("users"),
		type: v.string(),
		priority: v.string(),
		title: v.string(),
		message: v.string(),
		body: v.optional(v.string()),
		entityType: v.string(),
		entityId: v.string(),
		parentEntityId: v.optional(v.string()),
		metadata: v.optional(v.any()),
		isBatchable: v.optional(v.boolean()),
		batchKey: v.optional(v.string()),
	},
	returns: v.id("notifications"),
	handler: async (ctx, args) => {
		return await ctx.db.insert("notifications", {
			userId: args.userId,
			type: args.type,
			priority: args.priority ?? "normal",
			status: "unread",
			title: args.title,
			message: args.message,
			body: args.body,
			entityType: args.entityType,
			entityId: args.entityId,
			parentEntityId: args.parentEntityId,
			metadata: args.metadata,
			isBatchable: args.isBatchable ?? false,
			batchKey: args.batchKey,
		});
	},
});
