import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireDirector } from "./admin";
import { requireUserId, isVolunteer } from "./auth";
import { hasCompetitionAccess } from "./competitionAccess";

type ActivityLogDoc = Doc<"activityLog">;

const DEFAULT_ACTOR = { id: "", name: "", avatarUrl: "" };

async function resolveActorsAndMapDocs(
	ctx: QueryCtx,
	docs: ActivityLogDoc[],
): Promise<
	Array<{
		id: string;
		entityType: "task" | "update" | "competition";
		entityId: string;
		type: string;
		actor: { id: string; name: string; avatarUrl: string };
		timestamp: string;
		oldValue?: string;
		newValue?: string;
		metadata?: unknown;
	}>
> {
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
		actor: usersMap.get(d.actorId) ?? { ...DEFAULT_ACTOR, id: d.actorId },
		timestamp: toISO(d._creationTime),
		oldValue: d.oldValue,
		newValue: d.newValue,
		metadata: d.metadata,
	}));
}

async function isActivityRelevantToUser(
	ctx: QueryCtx,
	doc: ActivityLogDoc,
	userId: Id<"users">,
): Promise<boolean> {
	if (doc.actorId === userId) return true;
	if (doc.entityType === "task") {
		const task = await ctx.db.get("tasks", doc.entityId as Id<"tasks">);
		return task?.assigneeId === userId;
	}
	return false;
}

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

		return resolveActorsAndMapDocs(ctx, docs);
	},
});

export const listRecent = query({
	args: { limit: v.optional(v.number()) },
	returns: v.array(activityEntryReturns),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const limitToUse = args.limit ?? 50;
		const docs = await ctx.db
			.query("activityLog")
			.order("desc")
			.take(limitToUse);
		return resolveActorsAndMapDocs(ctx, docs);
	},
});

/**
 * Recent activity relevant to the current user: they are the actor,
 * or the entry is for a task assigned to them.
 */
export const listRecentForUser = query({
	args: { limit: v.optional(v.number()) },
	returns: v.array(activityEntryReturns),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const limitToUse = args.limit ?? 50;
		const fetchLimit = Math.min(limitToUse * 4, 200);
		const docs = await ctx.db
			.query("activityLog")
			.order("desc")
			.take(fetchLimit);

		const filtered: ActivityLogDoc[] = [];
		for (const d of docs) {
			if (await isActivityRelevantToUser(ctx, d, userId)) {
				filtered.push(d);
				if (filtered.length >= limitToUse) break;
			}
		}
		const toReturn = filtered.slice(0, limitToUse);
		return resolveActorsAndMapDocs(ctx, toReturn);
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

/** Internal: log with explicit actorId so nested runMutation keeps identity. */
export const logWithActor = internalMutation({
	args: {
		actorId: v.id("users"),
		entityType: v.union(
			v.literal("task"),
			v.literal("update"),
			v.literal("competition"),
		),
		entityId: v.string(),
		type: v.string(),
		oldValue: v.optional(v.string()),
		newValue: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	returns: v.id("activityLog"),
	handler: async (ctx, args) => {
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
