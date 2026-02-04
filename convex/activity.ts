import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./auth";

const entityType = v.union(
	v.literal("task"),
	v.literal("update"),
	v.literal("competition"),
);

const userShape = v.object({
	id: v.string(),
	name: v.string(),
	avatarUrl: v.string(),
});

const activityEntryReturns = v.object({
	id: v.string(),
	entityType,
	entityId: v.string(),
	type: v.string(),
	actor: userShape,
	timestamp: v.string(),
	oldValue: v.optional(v.string()),
	newValue: v.optional(v.string()),
	metadata: v.optional(v.any()),
});

export const listForEntity = query({
	args: {
		entityType,
		entityId: v.string(),
	},
	returns: v.array(activityEntryReturns),
	handler: async (ctx, args) => {
		// Only authenticated users can view activity.
		await requireUserId(ctx);
		const docs = await ctx.db
			.query("activityLog")
			.withIndex("by_entity", (q) =>
				q.eq("entityType", args.entityType).eq("entityId", args.entityId),
			)
			.order("desc")
			.collect();

		const actorIds = new Set<Id<"users">>();
		for (const d of docs) actorIds.add(d.actorId);
		const userArr = [...actorIds];
		const userDocs = await Promise.all(
			userArr.map((id) => ctx.db.get("users", id)),
		);
		const usersMap = new Map<
			string,
			{ id: string; name: string; avatarUrl: string }
		>();
		userArr.forEach((id, i) => {
			const u = userDocs[i];
			if (u)
				usersMap.set(id, {
					id,
					name: u.name ?? "",
					avatarUrl: u.image ?? "",
				});
		});

		const toISO = (ms: number) => new Date(ms).toISOString();

		return docs.map((d) => ({
			id: d._id,
			entityType: d.entityType,
			entityId: d.entityId,
			type: d.type,
			actor: usersMap.get(d.actorId) ?? {
				id: d.actorId,
				name: "",
				avatarUrl: "",
			},
			timestamp: toISO(d._creationTime),
			oldValue: d.oldValue,
			newValue: d.newValue,
			metadata: d.metadata,
		}));
	},
});

export const listRecent = query({
	args: { limit: v.optional(v.number()) },
	returns: v.array(activityEntryReturns),
	handler: async (ctx, args) => {
		// Only authenticated users can view recent activity.
		await requireUserId(ctx);
		const limit = args.limit ?? 50;
		const docs = await ctx.db.query("activityLog").order("desc").take(limit);

		const actorIds = new Set<Id<"users">>();
		for (const d of docs) actorIds.add(d.actorId);
		const userArr = [...actorIds];
		const userDocs = await Promise.all(
			userArr.map((id) => ctx.db.get("users", id)),
		);
		const usersMap = new Map<
			string,
			{ id: string; name: string; avatarUrl: string }
		>();
		userArr.forEach((id, i) => {
			const u = userDocs[i];
			if (u)
				usersMap.set(id, {
					id,
					name: u.name ?? "",
					avatarUrl: u.image ?? "",
				});
		});

		const toISO = (ms: number) => new Date(ms).toISOString();

		return docs.map((d) => ({
			id: d._id,
			entityType: d.entityType,
			entityId: d.entityId,
			type: d.type,
			actor: usersMap.get(d.actorId) ?? {
				id: d.actorId,
				name: "",
				avatarUrl: "",
			},
			timestamp: toISO(d._creationTime),
			oldValue: d.oldValue,
			newValue: d.newValue,
			metadata: d.metadata,
		}));
	},
});

export const log = mutation({
	args: {
		entityType,
		entityId: v.string(),
		type: v.string(),
		actorId: v.id("users"),
		oldValue: v.optional(v.string()),
		newValue: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	returns: v.id("activityLog"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		// Prevent clients from spoofing another actor.
		if (args.actorId !== userId) {
			throw new ConvexError("Cannot log activity for another user");
		}

		return await ctx.db.insert("activityLog", {
			entityType: args.entityType,
			entityId: args.entityId,
			type: args.type,
			actorId: args.actorId,
			oldValue: args.oldValue,
			newValue: args.newValue,
			metadata: args.metadata,
		});
	},
});
