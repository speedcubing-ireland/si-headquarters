import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireDirector } from "./admin";
import { requireUserId, isVolunteer } from "./auth";
import { hasCompetitionAccess } from "./competitionAccess";
import { toUsers, createLens, toISO } from "./lib/transforms";
import { entityType, activityMetadata, userShape } from "./lib/validators";
import type { Infer } from "convex/values";

type ActivityLogDoc = Doc<"activityLog">;

const DEFAULT_ACTOR = { id: "", name: "", avatarUrl: "" };

type ActivityMetadata = Infer<typeof activityMetadata>;

async function resolveActorsAndMapDocs(
	ctx: QueryCtx,
	docs: ActivityLogDoc[],
): Promise<
	Array<{
		id: string;
		entityType: "task" | "update" | "competition";
		entityId: string;
		type: string;
		actor: { id: Id<"users">; name: string; avatarUrl: string };
		timestamp: string;
		oldValue?: string;
		newValue?: string;
		metadata?: ActivityMetadata;
		entityTitle?: string;
		entityIdentifier?: string;
	}>
> {
	const actorIds = new Set<Id<"users">>();
	for (const d of docs) actorIds.add(d.actorId);
	const userArr = [...actorIds];
	const taskIds = new Set<Id<"tasks">>();
	for (const d of docs) {
		if (d.entityType === "task") taskIds.add(d.entityId as Id<"tasks">);
	}
	const taskArr = [...taskIds];

	const [userDocs, taskDocs] = await Promise.all([
		Promise.all(userArr.map((id) => ctx.db.get("users", id))),
		Promise.all(taskArr.map((id) => ctx.db.get("tasks", id))),
	]);

	const usersLens = createLens(toUsers(userDocs));

	const tasksMap = new Map<
		Id<"tasks">,
		{ title: string; identifier: string }
	>();
	taskArr.forEach((id, i) => {
		const t = taskDocs[i];
		if (t)
			tasksMap.set(id, {
				title: t.title,
				identifier: t.identifier,
			});
	});

	return docs.map((d) => {
		let entityTitle: string | undefined;
		let entityIdentifier: string | undefined;

		if (d.entityType === "task") {
			const t = tasksMap.get(d.entityId as Id<"tasks">);
			if (t) {
				entityTitle = t.title;
				entityIdentifier = t.identifier;
			}
		}

		return {
			id: d._id,
			entityType: d.entityType,
			entityId: d.entityId,
			type: d.type,
			actor: usersLens.get(d.actorId) ?? { ...DEFAULT_ACTOR, id: d.actorId },
			timestamp: toISO(d._creationTime),
			oldValue: d.oldValue,
			newValue: d.newValue,
			metadata: d.metadata as ActivityMetadata,
			entityTitle,
			entityIdentifier,
		};
	});
}

async function isActivityRelevantToUser(
	ctx: QueryCtx,
	doc: ActivityLogDoc,
	userId: Id<"users">,
): Promise<boolean> {
	if (doc.actorId === userId) return true;
	if (doc.entityType === "task") {
		const taskId = doc.entityId as Id<"tasks">;
		const task = await ctx.db.get(taskId);
		return task?.assigneeId === userId;
	}
	return false;
}

export const activityEntryReturns = v.object({
	id: v.string(),
	entityType,
	entityId: v.string(),
	type: v.string(),
	actor: userShape,
	timestamp: v.string(),
	oldValue: v.optional(v.string()),
	newValue: v.optional(v.string()),
	metadata: activityMetadata,
	entityTitle: v.optional(v.string()),
	entityIdentifier: v.optional(v.string()),
});

export const listForEntity = query({
	args: {
		entityType,
		entityId: v.string(),
	},
	returns: v.array(activityEntryReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);

		if (args.entityType === "task") {
			const taskId = args.entityId as Id<"tasks">;
			const task = await ctx.db.get(taskId);
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
			const updateId = args.entityId as Id<"competitionUpdates">;
			const update = await ctx.db.get(updateId);
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
				const competitionId = args.entityId as Id<"competitions">;
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					competitionId,
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
			.take(200);

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

export const listRecentForUser = query({
	args: { limit: v.optional(v.number()) },
	returns: v.array(activityEntryReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
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
