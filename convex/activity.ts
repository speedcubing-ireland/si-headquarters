import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireUserId, isVolunteer } from "./auth";

const entityType = v.union(
	v.literal("task"),
	v.literal("update"),
	v.literal("competition"),
);

/**
 * Check if a user has access to a competition.
 * Returns true if user is volunteer OR is organizer/lead/delegate of the competition.
 */
async function hasCompetitionAccess(
	ctx: QueryCtx,
	isVolunteer: boolean,
	userId: Id<"users">,
	competitionId: Id<"competitions"> | string | null | undefined,
): Promise<boolean> {
	if (isVolunteer) return true;
	if (!competitionId) return false;

	const competition = await ctx.db.get(
		"competitions",
		competitionId as Id<"competitions">,
	);
	if (!competition) return false;

	return (
		competition.organiserIds.includes(userId) ||
		competition.compLeadId === userId ||
		competition.leadDelegateId === userId
	);
}

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
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const volunteer = await isVolunteer(ctx);

		if (args.entityType === "task") {
			const task = await ctx.db.get("tasks", args.entityId as Id<"tasks">);
			if (!task) return [];

			if (!volunteer) {
				if (!task.parentCompetitionId) return [];
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					task.parentCompetitionId,
				);
				if (!hasAccess) return [];
			}
		} else if (args.entityType === "update") {
			const update = await ctx.db.get(
				"competitionUpdates",
				args.entityId as Id<"competitionUpdates">,
			);
			if (!update) return [];

			if (!volunteer) {
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					update.competitionId,
				);
				if (!hasAccess) return [];
			}
		} else if (args.entityType === "competition") {
			if (!volunteer) {
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					args.entityId as Id<"competitions">,
				);
				if (!hasAccess) return [];
			}
		}

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
		oldValue: v.optional(v.string()),
		newValue: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	returns: v.id("activityLog"),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		return await ctx.db.insert("activityLog", {
			entityType: args.entityType,
			entityId: args.entityId,
			type: args.type,
			actorId: userId,
			oldValue: args.oldValue,
			newValue: args.newValue,
			metadata: args.metadata,
		});
	},
});
