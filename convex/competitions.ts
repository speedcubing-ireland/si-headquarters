import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUserId, isVolunteer } from "./auth";
import { internal } from "./_generated/api";

const phaseShape = v.object({
	id: v.string(),
	name: v.string(),
	description: v.string(),
});

const compSheetObject = v.object({
	type: v.literal("google-sheet"),
	sheetId: v.string(),
});

const competitionDoc = v.object({
	_id: v.id("competitions"),
	_creationTime: v.number(),
	name: v.string(),
	description: v.string(),
	compStart: v.string(),
	compEnd: v.string(),
	compLeadId: v.optional(v.id("users")),
	leadDelegateId: v.optional(v.id("users")),
	organiserIds: v.array(v.id("users")),
	currentPhaseId: v.optional(v.id("phases")),
	compSheet: v.optional(compSheetObject),
	updatedAt: v.number(),
});

const userShape = v.object({
	id: v.string(),
	name: v.string(),
	avatarUrl: v.string(),
});

const taskSummaryShape = v.object({
	id: v.id("tasks"),
	status: v.string(),
});

const progressUpdateStatus = v.union(
	v.literal("on-track"),
	v.literal("at-risk"),
	v.literal("off-track"),
);
const progressUpdateReactionShape = v.object({
	emoji: v.string(),
	users: v.array(userShape),
});
const progressUpdateForUIReturns = v.object({
	id: v.id("competitionUpdates"),
	timestamp: v.string(),
	postedBy: userShape,
	status: progressUpdateStatus,
	message: v.optional(v.string()),
	reactions: v.array(progressUpdateReactionShape),
});

const competitionForUIReturns = v.object({
	id: v.string(),
	name: v.string(),
	description: v.string(),
	compStart: v.string(),
	compEnd: v.string(),
	compLead: v.union(userShape, v.null()),
	leadDelegate: v.union(userShape, v.null()),
	organisers: v.array(userShape),
	phases: v.array(phaseShape),
	currentPhaseIdx: v.number(),
	progressUpdates: v.array(progressUpdateForUIReturns),
	compSheet: v.union(compSheetObject, v.null()),
	tasks: v.array(taskSummaryShape),
	createdAt: v.string(),
	updatedAt: v.string(),
});

export const list = query({
	args: {},
	returns: v.array(competitionDoc),
	handler: async (ctx) => {
		// Competitions are only visible to authenticated users.
		await requireUserId(ctx);
		return await ctx.db
			.query("competitions")
			.withIndex("by_comp_start")
			.order("asc")
			.collect();
	},
});

export const get = query({
	args: { competitionId: v.id("competitions") },
	returns: v.union(competitionDoc, v.null()),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const competition = await ctx.db.get("competitions", args.competitionId);
		if (!competition) return null;

		const volunteer = await isVolunteer(ctx);
		if (volunteer) {
			return competition;
		}

		// Guest organizers only see competitions where they're listed as organizers
		if (
			competition.organiserIds.includes(userId) ||
			competition.compLeadId === userId ||
			competition.leadDelegateId === userId
		) {
			return competition;
		}

		return null;
	},
});

function toISO(ms: number): string {
	return new Date(ms).toISOString();
}

async function loadTaskSummariesForCompetition(
	ctx: QueryCtx,
	competitionId: Id<"competitions">,
): Promise<{ id: Id<"tasks">; status: string }[]> {
	const taskDocs = await ctx.db
		.query("tasks")
		.withIndex("by_parent_competition_and_archived", (q) =>
			q.eq("parentCompetitionId", competitionId).eq("archived", false),
		)
		.collect();
	return taskDocs.map((t) => ({ id: t._id, status: t.status }));
}

type UserShape = { id: string; name: string; avatarUrl: string };

function collectUserIdsFromUpdates(
	updateDocs: Doc<"competitionUpdates">[],
	out: Set<Id<"users">>,
): void {
	for (const u of updateDocs) {
		out.add(u.authorId);
		for (const r of u.reactions) {
			for (const id of r.userIds) out.add(id);
		}
	}
}

function buildProgressUpdatesForUI(
	updateDocs: Doc<"competitionUpdates">[],
	usersMap: Map<string, UserShape>,
): {
	id: Id<"competitionUpdates">;
	timestamp: string;
	postedBy: UserShape;
	status: "on-track" | "at-risk" | "off-track";
	message?: string;
	reactions: { emoji: string; users: UserShape[] }[];
}[] {
	return updateDocs.map((doc) => ({
		id: doc._id,
		timestamp: toISO(doc._creationTime),
		postedBy: usersMap.get(doc.authorId) ?? {
			id: doc.authorId,
			name: "",
			avatarUrl: "",
		},
		status: doc.status,
		message: doc.message,
		reactions: doc.reactions.map((r) => ({
			emoji: r.emoji,
			users: r.userIds
				.map((id) => usersMap.get(id))
				.filter((u): u is UserShape => Boolean(u)),
		})),
	}));
}

export const listForUI = query({
	args: {},
	returns: v.array(competitionForUIReturns),
	handler: async (ctx) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const volunteer = await isVolunteer(ctx);

		let docs: Doc<"competitions">[];
		if (volunteer) {
			// Volunteers see all competitions
			docs = await ctx.db
				.query("competitions")
				.withIndex("by_comp_start")
				.order("asc")
				.collect();
		} else {
			// Guest organizers only see competitions where they're listed as organizers
			const allCompetitions = await ctx.db
				.query("competitions")
				.withIndex("by_comp_start")
				.order("asc")
				.collect();
			docs = allCompetitions.filter(
				(comp) =>
					comp.organiserIds.includes(userId) ||
					comp.compLeadId === userId ||
					comp.leadDelegateId === userId,
			);
		}

		const phases: Doc<"phases">[] = await ctx.db
			.query("phases")
			.withIndex("by_order")
			.order("asc")
			.collect();

		const orderedPhases = phases
			.filter((p) => !p.archived)
			.sort((a, b) => a.order - b.order);

		const defaultPhaseId = orderedPhases[0]?._id;

		const userIds = new Set<Id<"users">>();
		const tasksByCompetition = new Map<
			Id<"competitions">,
			{ id: Id<"tasks">; status: string }[]
		>();
		const updatesByCompetition = new Map<
			Id<"competitions">,
			Doc<"competitionUpdates">[]
		>();
		for (const d of docs) {
			if (d.compLeadId) userIds.add(d.compLeadId);
			if (d.leadDelegateId) userIds.add(d.leadDelegateId);
			for (const id of d.organiserIds) userIds.add(id);
			tasksByCompetition.set(
				d._id,
				await loadTaskSummariesForCompetition(ctx, d._id),
			);
			const updateDocs = await ctx.db
				.query("competitionUpdates")
				.withIndex("by_competition", (q) => q.eq("competitionId", d._id))
				.order("desc")
				.collect();
			updatesByCompetition.set(d._id, updateDocs);
			collectUserIdsFromUpdates(updateDocs, userIds);
		}

		const userArr = [...userIds];
		const userDocs = await Promise.all(
			userArr.map((id) => ctx.db.get("users", id)),
		);
		const usersMap = new Map<string, UserShape>();
		userArr.forEach((id, i) => {
			const u = userDocs[i];
			if (u)
				usersMap.set(id, {
					id,
					name: u.name ?? "",
					avatarUrl: u.image ?? "",
				});
		});

		return docs.map((d) => {
			const phasesForUI = orderedPhases.map((p) => ({
				id: p._id,
				name: p.name,
				description: p.description,
			}));

			const currentPhaseId = d.currentPhaseId ?? defaultPhaseId;
			const currentPhaseIdx =
				currentPhaseId != null
					? phasesForUI.findIndex((p) => p.id === currentPhaseId)
					: 0;

			const tasksForComp = tasksByCompetition.get(d._id) ?? [];
			const updateDocs = updatesByCompetition.get(d._id) ?? [];

			return {
				id: d._id,
				name: d.name,
				description: d.description,
				compStart: d.compStart,
				compEnd: d.compEnd,
				compLead: d.compLeadId ? (usersMap.get(d.compLeadId) ?? null) : null,
				leadDelegate: d.leadDelegateId
					? (usersMap.get(d.leadDelegateId) ?? null)
					: null,
				organisers: d.organiserIds
					.map((id) => usersMap.get(id))
					.filter((u): u is UserShape => Boolean(u)),
				phases: phasesForUI,
				currentPhaseIdx: currentPhaseIdx >= 0 ? currentPhaseIdx : 0,
				progressUpdates: buildProgressUpdatesForUI(updateDocs, usersMap),
				compSheet: d.compSheet ?? null,
				tasks: tasksForComp,
				createdAt: toISO(d._creationTime),
				updatedAt: toISO(d.updatedAt),
			};
		});
	},
});

export const getForUI = query({
	args: { competitionId: v.id("competitions") },
	returns: v.union(competitionForUIReturns, v.null()),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const d = await ctx.db.get("competitions", args.competitionId);
		if (!d) return null;

		const volunteer = await isVolunteer(ctx);
		if (!volunteer) {
			// Guest organizers only see competitions where they're listed as organizers
			if (
				!d.organiserIds.includes(userId) &&
				d.compLeadId !== userId &&
				d.leadDelegateId !== userId
			) {
				return null;
			}
		}

		const phases: Doc<"phases">[] = await ctx.db
			.query("phases")
			.withIndex("by_order")
			.order("asc")
			.collect();

		const orderedPhases = phases
			.filter((p) => !p.archived)
			.sort((a, b) => a.order - b.order);

		const phasesForUI = orderedPhases.map((p) => ({
			id: p._id,
			name: p.name,
			description: p.description,
		}));

		const defaultPhaseId = orderedPhases[0]?._id;
		const currentPhaseId = d.currentPhaseId ?? defaultPhaseId;
		const currentPhaseIdx =
			currentPhaseId != null
				? phasesForUI.findIndex((p) => p.id === currentPhaseId)
				: 0;

		const userIds = new Set<Id<"users">>();
		if (d.compLeadId) userIds.add(d.compLeadId);
		if (d.leadDelegateId) userIds.add(d.leadDelegateId);
		for (const id of d.organiserIds) userIds.add(id);

		const updateDocs = await ctx.db
			.query("competitionUpdates")
			.withIndex("by_competition", (q) =>
				q.eq("competitionId", args.competitionId),
			)
			.order("desc")
			.collect();
		collectUserIdsFromUpdates(updateDocs, userIds);

		const userArr = [...userIds];
		const userDocs = await Promise.all(
			userArr.map((id) => ctx.db.get("users", id)),
		);
		const usersMap = new Map<string, UserShape>();
		userArr.forEach((id, i) => {
			const u = userDocs[i];
			if (u)
				usersMap.set(id, {
					id,
					name: u.name ?? "",
					avatarUrl: u.image ?? "",
				});
		});

		const tasks = await loadTaskSummariesForCompetition(
			ctx,
			args.competitionId,
		);

		return {
			id: d._id,
			name: d.name,
			description: d.description,
			compStart: d.compStart,
			compEnd: d.compEnd,
			compLead: d.compLeadId ? (usersMap.get(d.compLeadId) ?? null) : null,
			leadDelegate: d.leadDelegateId
				? (usersMap.get(d.leadDelegateId) ?? null)
				: null,
			organisers: d.organiserIds
				.map((id) => usersMap.get(id))
				.filter((u): u is UserShape => Boolean(u)),
			phases: phasesForUI,
			currentPhaseIdx: currentPhaseIdx >= 0 ? currentPhaseIdx : 0,
			progressUpdates: buildProgressUpdatesForUI(updateDocs, usersMap),
			compSheet: d.compSheet ?? null,
			tasks,
			createdAt: toISO(d._creationTime),
			updatedAt: toISO(d.updatedAt),
		};
	},
});

const createArgs = {
	name: v.string(),
	description: v.optional(v.string()),
	compStart: v.string(),
	compEnd: v.string(),
	compLeadId: v.optional(v.id("users")),
	leadDelegateId: v.optional(v.id("users")),
	organiserIds: v.optional(v.array(v.id("users"))),
	currentPhaseId: v.optional(v.id("phases")),
	compSheet: v.optional(compSheetObject),
};

export const create = mutation({
	args: createArgs,
	returns: v.id("competitions"),
	handler: async (ctx, args) => {
		const volunteer = await isVolunteer(ctx);

		if (!volunteer) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Only volunteers can create competitions",
			});
		}

		const now = Date.now();

		const phases: Doc<"phases">[] = await ctx.db
			.query("phases")
			.withIndex("by_order")
			.order("asc")
			.collect();
		const orderedPhases = phases
			.filter((p) => !p.archived)
			.sort((a, b) => a.order - b.order);
		const defaultPhaseId = orderedPhases[0]?._id;

		return await ctx.db.insert("competitions", {
			name: args.name,
			description: args.description ?? "",
			compStart: args.compStart,
			compEnd: args.compEnd,
			compLeadId: args.compLeadId,
			leadDelegateId: args.leadDelegateId,
			organiserIds: args.organiserIds ?? [],
			currentPhaseId: args.currentPhaseId ?? defaultPhaseId,
			compSheet: args.compSheet,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		competitionId: v.id("competitions"),
		updates: v.object({
			name: v.optional(v.string()),
			description: v.optional(v.string()),
			compStart: v.optional(v.string()),
			compEnd: v.optional(v.string()),
			compLeadId: v.optional(v.union(v.id("users"), v.null())),
			leadDelegateId: v.optional(v.union(v.id("users"), v.null())),
			organiserIds: v.optional(v.array(v.id("users"))),
			currentPhaseId: v.optional(v.id("phases")),
			compSheet: v.optional(v.union(compSheetObject, v.null())),
		}),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("competitions", args.competitionId);
		if (!doc) return null;

		const u = args.updates;
		const patch: Record<string, unknown> = { updatedAt: Date.now() };
		if (u.name !== undefined) patch.name = u.name;
		if (u.description !== undefined) patch.description = u.description;
		if (u.compStart !== undefined) patch.compStart = u.compStart;
		if (u.compEnd !== undefined) patch.compEnd = u.compEnd;
		if (u.compLeadId !== undefined)
			patch.compLeadId = u.compLeadId ?? undefined;
		if (u.leadDelegateId !== undefined)
			patch.leadDelegateId = u.leadDelegateId ?? undefined;
		if (u.organiserIds !== undefined) patch.organiserIds = u.organiserIds;
		if (u.currentPhaseId !== undefined)
			patch.currentPhaseId = u.currentPhaseId ?? undefined;
		if (u.compSheet !== undefined) patch.compSheet = u.compSheet ?? undefined;

		const oldPhaseId = doc.currentPhaseId;
		const newPhaseId = u.currentPhaseId ?? doc.currentPhaseId;

		await ctx.db.patch(
			"competitions",
			args.competitionId,
			patch as Record<string, unknown>,
		);

		if (oldPhaseId !== newPhaseId && u.currentPhaseId !== undefined && userId) {
			const phases: Doc<"phases">[] = await ctx.db
				.query("phases")
				.withIndex("by_order")
				.order("asc")
				.collect();

			const oldPhase = oldPhaseId
				? phases.find((p) => p._id === oldPhaseId)
				: null;
			const newPhase = newPhaseId
				? phases.find((p) => p._id === newPhaseId)
				: null;

			const oldPhaseName = oldPhase?.name ?? "Unknown";
			const newPhaseName = newPhase?.name ?? "Unknown";

			const recipients = new Set<Id<"users">>();
			if (doc.compLeadId) recipients.add(doc.compLeadId);
			if (doc.leadDelegateId) recipients.add(doc.leadDelegateId);
			for (const organiserId of doc.organiserIds) {
				recipients.add(organiserId);
			}

			const notificationPromises = Array.from(recipients)
				.filter((recipientId) => recipientId !== userId)
				.map((recipientId) =>
					ctx.scheduler.runAfter(
						0,
						internal.notifications._notifyCompetitionPhaseChanged,
						{
							competitionId: args.competitionId,
							recipientId,
							actorId: userId,
							oldPhaseName,
							newPhaseName,
						},
					),
				);

			await Promise.allSettled(notificationPromises);

			if (newPhaseId !== null) {
				const competitionTasks = await ctx.db
					.query("tasks")
					.withIndex("by_parent_competition", (q) =>
						q.eq("parentCompetitionId", args.competitionId),
					)
					.collect();
				const now = Date.now();
				const backlogTasksInPhase = competitionTasks.filter(
					(task) => task.phaseId === newPhaseId && task.status === "backlog",
				);
				await Promise.all(
					backlogTasksInPhase.map((task) =>
						ctx.db.patch("tasks", task._id, {
							status: "to-do",
							updatedAt: now,
						}),
					),
				);
			}
		}

		return null;
	},
});

async function collectAllTaskIdsRecursively(
	ctx: QueryCtx,
	parentTaskIds: Id<"tasks">[],
	allTaskIds: Set<Id<"tasks">>,
): Promise<void> {
	const subtaskPromises = parentTaskIds.map(async (parentTaskId) => {
		if (allTaskIds.has(parentTaskId)) return [];
		allTaskIds.add(parentTaskId);
		const subtasks = await ctx.db
			.query("tasks")
			.withIndex("by_parent_task", (q) => q.eq("parentTaskId", parentTaskId))
			.collect();
		return subtasks.map((t) => t._id);
	});

	const allSubtasks = (await Promise.all(subtaskPromises)).flat();
	if (allSubtasks.length > 0) {
		await collectAllTaskIdsRecursively(ctx, allSubtasks, allTaskIds);
	}
}

async function collectAllCommentIdsRecursively(
	ctx: MutationCtx,
	commentIds: Id<"comments">[],
	allCommentIds: Set<Id<"comments">>,
): Promise<void> {
	const nestedPromises = commentIds.map(async (commentId) => {
		if (allCommentIds.has(commentId)) return [];
		allCommentIds.add(commentId);
		const nested = await ctx.db
			.query("comments")
			.withIndex("by_parent_comment", (q) => q.eq("parentCommentId", commentId))
			.collect();
		return nested.map((n) => n._id);
	});

	const allNested = (await Promise.all(nestedPromises)).flat();
	if (allNested.length > 0) {
		await collectAllCommentIdsRecursively(ctx, allNested, allCommentIds);
	}
}

async function deleteCommentsAndReplies(
	ctx: MutationCtx,
	parentType: "task" | "update",
	parentId: string,
): Promise<void> {
	const comments = await ctx.db
		.query("comments")
		.withIndex("by_parent", (q) =>
			q.eq("parentType", parentType).eq("parentId", parentId),
		)
		.collect();

	const allCommentIds = new Set<Id<"comments">>();
	await collectAllCommentIdsRecursively(
		ctx,
		comments.map((c) => c._id),
		allCommentIds,
	);

	await Promise.all(
		Array.from(allCommentIds).map((id) => ctx.db.delete("comments", id)),
	);
}

export const remove = mutation({
	args: { competitionId: v.id("competitions") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const volunteer = await isVolunteer(ctx);

		if (!volunteer) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Only volunteers can delete competitions",
			});
		}

		const doc = await ctx.db.get("competitions", args.competitionId);
		if (!doc) return null;

		const competitionTasks = await ctx.db
			.query("tasks")
			.withIndex("by_parent_competition", (q) =>
				q.eq("parentCompetitionId", args.competitionId),
			)
			.collect();

		const allTaskIds = new Set<Id<"tasks">>();
		await collectAllTaskIdsRecursively(
			ctx,
			competitionTasks.map((t) => t._id),
			allTaskIds,
		);
		const taskIdArray = Array.from(allTaskIds);

		const competitionUpdates = await ctx.db
			.query("competitionUpdates")
			.withIndex("by_competition", (q) =>
				q.eq("competitionId", args.competitionId),
			)
			.collect();

		const allReminders = await ctx.db.query("reminders").collect();
		const remindersToDelete = allReminders.filter(
			(r) =>
				r.entityType === "task" &&
				taskIdArray.includes(r.entityId as Id<"tasks">),
		);

		const allNotifications = await ctx.db.query("notifications").collect();
		const notificationsToDelete = allNotifications.filter(
			(n) =>
				(n.entityType === "competition" && n.entityId === args.competitionId) ||
				(n.entityType === "task" &&
					taskIdArray.includes(n.entityId as Id<"tasks">)),
		);

		const competitionActivityLogs = await ctx.db
			.query("activityLog")
			.withIndex("by_entity", (q) =>
				q.eq("entityType", "competition").eq("entityId", args.competitionId),
			)
			.collect();

		const taskActivityLogPromises = taskIdArray.map((taskId) =>
			ctx.db
				.query("activityLog")
				.withIndex("by_entity", (q) =>
					q.eq("entityType", "task").eq("entityId", taskId),
				)
				.collect(),
		);
		const taskActivityLogs = (
			await Promise.all(taskActivityLogPromises)
		).flat();

		await Promise.all([
			...remindersToDelete.map((r) => ctx.db.delete("reminders", r._id)),
			...notificationsToDelete.map((n) =>
				ctx.db.delete("notifications", n._id),
			),
			...competitionActivityLogs.map((l) =>
				ctx.db.delete("activityLog", l._id),
			),
			...taskActivityLogs.map((l) => ctx.db.delete("activityLog", l._id)),
		]);

		await Promise.all([
			...taskIdArray.map((taskId) =>
				deleteCommentsAndReplies(ctx, "task", taskId),
			),
			...competitionUpdates.map((update) =>
				deleteCommentsAndReplies(ctx, "update", update._id),
			),
		]);

		await Promise.all([
			...taskIdArray.map((taskId) => ctx.db.delete("tasks", taskId)),
			...competitionUpdates.map((update) =>
				ctx.db.delete("competitionUpdates", update._id),
			),
		]);

		await ctx.db.delete("competitions", args.competitionId);
		return null;
	},
});
