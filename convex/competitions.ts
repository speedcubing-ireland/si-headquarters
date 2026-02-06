import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUserId, isVolunteer } from "./auth";
import { internal } from "./_generated/api";
import { logActivity } from "./lib/activity";
import {
	collectAllTaskIdsRecursively,
	deleteTasksAndRelatedData,
	deleteCommentsAndReplies,
	deleteEntitySubscriptions,
} from "./lib/taskDeletion";
import { userCanAccessCompetitionDoc } from "./competitionAccess";
import { toUsers, createLens, toISO, type UserUI } from "./lib/transforms";
import { phaseShape, taskStatus, userShape } from "./lib/validators";
import type { TaskStatus } from "./lib/types";

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

const taskSummaryShape = v.object({
	id: v.id("tasks"),
	status: taskStatus,
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
export const progressUpdateForUIReturns = v.object({
	id: v.id("competitionUpdates"),
	timestamp: v.string(),
	postedBy: userShape,
	status: progressUpdateStatus,
	message: v.optional(v.string()),
	reactions: v.array(progressUpdateReactionShape),
});

export const competitionForUIReturns = v.object({
	id: v.id("competitions"),
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
		const userId = await requireUserId(ctx);
		const competition = await ctx.db.get("competitions", args.competitionId);
		if (!competition) return null;

		const volunteer = await isVolunteer(ctx);
		if (volunteer) return competition;
		if (!userCanAccessCompetitionDoc(competition, userId)) return null;
		return competition;
	},
});

type TaskSummary = { id: Id<"tasks">; status: TaskStatus };

async function loadTaskSummariesForCompetition(
	ctx: QueryCtx,
	competitionId: Id<"competitions">,
): Promise<TaskSummary[]> {
	const taskDocs = await ctx.db
		.query("tasks")
		.withIndex("by_parent_competition_and_archived", (q) =>
			q.eq("parentCompetitionId", competitionId).eq("archived", false),
		)
		.collect();
	return taskDocs.map((t) => ({ id: t._id, status: t.status }));
}

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
	usersLens: ReturnType<typeof createLens<UserUI>>,
): {
	id: Id<"competitionUpdates">;
	timestamp: string;
	postedBy: UserUI;
	status: "on-track" | "at-risk" | "off-track";
	message?: string;
	reactions: { emoji: string; users: UserUI[] }[];
}[] {
	return updateDocs.map((doc) => ({
		id: doc._id,
		timestamp: toISO(doc._creationTime),
		postedBy: usersLens.get(doc.authorId) ?? {
			id: doc.authorId,
			name: "",
			avatarUrl: "",
		},
		status: doc.status,
		message: doc.message,
		reactions: doc.reactions.map((r) => ({
			emoji: r.emoji,
			users: r.userIds
				.map((id) => usersLens.get(id))
				.filter((u): u is UserUI => Boolean(u)),
		})),
	}));
}

export const listForUI = query({
	args: {},
	returns: v.array(competitionForUIReturns),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);

		let docs: Doc<"competitions">[];
		if (volunteer) {
			docs = await ctx.db
				.query("competitions")
				.withIndex("by_comp_start")
				.order("asc")
				.collect();
		} else {
			const allCompetitions = await ctx.db
				.query("competitions")
				.withIndex("by_comp_start")
				.order("asc")
				.collect();
			docs = allCompetitions.filter((comp) =>
				userCanAccessCompetitionDoc(comp, userId),
			);
		}

		const phases: Doc<"phases">[] = await ctx.db
			.query("phases")
			.withIndex("by_order")
			.order("asc")
			.collect();

		const orderedPhases = phases.filter((p) => !p.archived);

		const defaultPhaseId = orderedPhases[0]?._id;

		const userIds = new Set<Id<"users">>();
		const tasksByCompetition = new Map<Id<"competitions">, TaskSummary[]>();
		const updatesByCompetition = new Map<
			Id<"competitions">,
			Doc<"competitionUpdates">[]
		>();

		const [taskResults, updateResults] = await Promise.all([
			Promise.all(docs.map((d) => loadTaskSummariesForCompetition(ctx, d._id))),
			Promise.all(
				docs.map((d) =>
					ctx.db
						.query("competitionUpdates")
						.withIndex("by_competition", (q) => q.eq("competitionId", d._id))
						.order("desc")
						.collect(),
				),
			),
		]);

		for (let i = 0; i < docs.length; i++) {
			const d = docs[i];
			if (d.compLeadId) userIds.add(d.compLeadId);
			if (d.leadDelegateId) userIds.add(d.leadDelegateId);
			for (const id of d.organiserIds) userIds.add(id);
			tasksByCompetition.set(d._id, taskResults[i]);
			updatesByCompetition.set(d._id, updateResults[i]);
			collectUserIdsFromUpdates(updateResults[i], userIds);
		}

		const userArr = [...userIds];
		const userDocs = await Promise.all(userArr.map((id) => ctx.db.get(id)));
		const usersLens = createLens(toUsers(userDocs));

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
				compLead: d.compLeadId ? (usersLens.get(d.compLeadId) ?? null) : null,
				leadDelegate: d.leadDelegateId
					? (usersLens.get(d.leadDelegateId) ?? null)
					: null,
				organisers: d.organiserIds
					.map((id) => usersLens.get(id))
					.filter((u): u is UserUI => Boolean(u)),
				phases: phasesForUI,
				currentPhaseIdx: currentPhaseIdx >= 0 ? currentPhaseIdx : 0,
				progressUpdates: buildProgressUpdatesForUI(updateDocs, usersLens),
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
		const userId = await requireUserId(ctx);
		const d = await ctx.db.get("competitions", args.competitionId);
		if (!d) return null;

		const volunteer = await isVolunteer(ctx);
		if (!volunteer && !userCanAccessCompetitionDoc(d, userId)) return null;

		const phases: Doc<"phases">[] = await ctx.db
			.query("phases")
			.withIndex("by_order")
			.order("asc")
			.collect();

		const orderedPhases = phases.filter((p) => !p.archived);

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
		const usersLens = createLens(toUsers(userDocs));

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
			compLead: d.compLeadId ? (usersLens.get(d.compLeadId) ?? null) : null,
			leadDelegate: d.leadDelegateId
				? (usersLens.get(d.leadDelegateId) ?? null)
				: null,
			organisers: d.organiserIds
				.map((id) => usersLens.get(id))
				.filter((u): u is UserUI => Boolean(u)),
			phases: phasesForUI,
			currentPhaseIdx: currentPhaseIdx >= 0 ? currentPhaseIdx : 0,
			progressUpdates: buildProgressUpdatesForUI(updateDocs, usersLens),
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

		if (!args.name.trim()) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Competition name is required",
			});
		}

		const now = Date.now();

		const phases: Doc<"phases">[] = await ctx.db
			.query("phases")
			.withIndex("by_order")
			.order("asc")
			.collect();
		const orderedPhases = phases.filter((p) => !p.archived);
		const defaultPhaseId = orderedPhases[0]?._id;

		const competitionId = await ctx.db.insert("competitions", {
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
		const userId = await requireUserId(ctx);
		await logActivity(ctx, userId, "competition", competitionId, "created");
		return competitionId;
	},
});

const competitionUpdateValidator = v.object({
	name: v.optional(v.string()),
	description: v.optional(v.string()),
	compStart: v.optional(v.string()),
	compEnd: v.optional(v.string()),
	compLeadId: v.optional(v.union(v.id("users"), v.null())),
	leadDelegateId: v.optional(v.union(v.id("users"), v.null())),
	organiserIds: v.optional(v.array(v.id("users"))),
	currentPhaseId: v.optional(v.id("phases")),
	compSheet: v.optional(v.union(compSheetObject, v.null())),
});

type CompetitionUpdates = {
	name?: string;
	description?: string;
	compStart?: string;
	compEnd?: string;
	compLeadId?: Id<"users"> | null;
	leadDelegateId?: Id<"users"> | null;
	organiserIds?: Id<"users">[];
	currentPhaseId?: Id<"phases">;
	compSheet?: Doc<"competitions">["compSheet"] | null;
};

type CompetitionPatch = Partial<Doc<"competitions">> & { updatedAt: number };

type PhaseTransition = {
	oldPhaseId: Id<"phases"> | undefined;
	newPhaseId: Id<"phases"> | undefined;
	hasPhaseChange: boolean;
};

function buildCompetitionPatch(updates: CompetitionUpdates): CompetitionPatch {
	const patch: CompetitionPatch = { updatedAt: Date.now() };
	if (updates.name !== undefined) patch.name = updates.name;
	if (updates.description !== undefined)
		patch.description = updates.description;
	if (updates.compStart !== undefined) patch.compStart = updates.compStart;
	if (updates.compEnd !== undefined) patch.compEnd = updates.compEnd;
	if (updates.compLeadId !== undefined)
		patch.compLeadId = updates.compLeadId ?? undefined;
	if (updates.leadDelegateId !== undefined)
		patch.leadDelegateId = updates.leadDelegateId ?? undefined;
	if (updates.organiserIds !== undefined)
		patch.organiserIds = updates.organiserIds;
	if (updates.currentPhaseId !== undefined)
		patch.currentPhaseId = updates.currentPhaseId ?? undefined;
	if (updates.compSheet !== undefined)
		patch.compSheet = updates.compSheet ?? undefined;
	return patch;
}

function resolvePhaseTransition(
	currentCompetition: Doc<"competitions">,
	updates: CompetitionUpdates,
): PhaseTransition {
	const oldPhaseId = currentCompetition.currentPhaseId;
	const newPhaseId =
		updates.currentPhaseId ?? currentCompetition.currentPhaseId;
	return {
		oldPhaseId,
		newPhaseId,
		hasPhaseChange:
			updates.currentPhaseId !== undefined && oldPhaseId !== newPhaseId,
	};
}

async function loadPhaseName(
	ctx: Pick<MutationCtx, "db">,
	phaseId: Id<"phases"> | undefined,
): Promise<string> {
	if (!phaseId) {
		return "Unknown";
	}
	const phase = await ctx.db.get("phases", phaseId);
	return phase?.name ?? "Unknown";
}

function collectPhaseChangeRecipientIds(
	competition: Doc<"competitions">,
	actorId: Id<"users">,
): Id<"users">[] {
	const recipients = new Set<Id<"users">>();
	if (competition.compLeadId) recipients.add(competition.compLeadId);
	if (competition.leadDelegateId) recipients.add(competition.leadDelegateId);
	for (const organiserId of competition.organiserIds) {
		recipients.add(organiserId);
	}
	recipients.delete(actorId);
	return [...recipients];
}

async function notifyPhaseChangeRecipients(
	ctx: MutationCtx,
	args: {
		competition: Doc<"competitions">;
		competitionId: Id<"competitions">;
		actorId: Id<"users">;
		oldPhaseName: string;
		newPhaseName: string;
	},
): Promise<void> {
	const recipientIds = collectPhaseChangeRecipientIds(
		args.competition,
		args.actorId,
	);
	await ctx.scheduler.runAfter(
		0,
		internal.notifications._notifyCompetitionPhaseChanged,
		{
			competitionId: args.competitionId,
			recipientIds: recipientIds,
			actorId: args.actorId,
			oldPhaseName: args.oldPhaseName,
			newPhaseName: args.newPhaseName,
			eventKey: `${args.competitionId}:${args.oldPhaseName}:${args.newPhaseName}:${Date.now()}`,
		},
	);
}

async function promoteBacklogTasksInPhase(
	ctx: MutationCtx,
	competitionId: Id<"competitions">,
	phaseId: Id<"phases">,
): Promise<void> {
	const competitionTasks = await ctx.db
		.query("tasks")
		.withIndex("by_parent_competition_and_archived", (q) =>
			q.eq("parentCompetitionId", competitionId).eq("archived", false),
		)
		.collect();
	const now = Date.now();
	const backlogTasksInPhase = competitionTasks.filter(
		(task) => task.phaseId === phaseId && task.status === "backlog",
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

export const update = mutation({
	args: {
		competitionId: v.id("competitions"),
		updates: competitionUpdateValidator,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const doc = await ctx.db.get("competitions", args.competitionId);
		if (!doc) return null;

		if (!volunteer && !userCanAccessCompetitionDoc(doc, userId)) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You do not have access to update this competition",
			});
		}

		const patch = buildCompetitionPatch(args.updates);
		const phaseTransition = resolvePhaseTransition(doc, args.updates);

		await ctx.db.patch("competitions", args.competitionId, patch);

		if (!phaseTransition.hasPhaseChange) {
			return null;
		}

		const [oldPhaseName, newPhaseName] = await Promise.all([
			loadPhaseName(ctx, phaseTransition.oldPhaseId),
			loadPhaseName(ctx, phaseTransition.newPhaseId),
		]);

		await logActivity(
			ctx,
			userId,
			"competition",
			args.competitionId,
			"phase_changed",
			{
				fieldName: "currentPhaseId",
				message: `${oldPhaseName} -> ${newPhaseName}`,
			},
		);
		await notifyPhaseChangeRecipients(ctx, {
			competition: doc,
			competitionId: args.competitionId,
			actorId: userId,
			oldPhaseName,
			newPhaseName,
		});
		if (phaseTransition.newPhaseId) {
			await promoteBacklogTasksInPhase(
				ctx,
				args.competitionId,
				phaseTransition.newPhaseId,
			);
		}

		return null;
	},
});

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
			.withIndex("by_parent_competition_and_archived", (q) =>
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

		await deleteTasksAndRelatedData(ctx, taskIdArray);

		const notificationsToDelete = await ctx.db
			.query("notifications")
			.withIndex("by_entity", (q) =>
				q.eq("entityType", "competition").eq("entityId", args.competitionId),
			)
			.collect();

		const competitionActivityLogs = await ctx.db
			.query("activityLog")
			.withIndex("by_entity", (q) =>
				q.eq("entityType", "competition").eq("entityId", args.competitionId),
			)
			.collect();

		await Promise.all([
			...notificationsToDelete.map((n) =>
				ctx.db.delete("notifications", n._id),
			),
			...competitionActivityLogs.map((l) =>
				ctx.db.delete("activityLog", l._id),
			),
		]);
		await deleteEntitySubscriptions(ctx, "competition", [
			`${args.competitionId}`,
		]);

		for (const update of competitionUpdates) {
			await deleteCommentsAndReplies(ctx, "update", update._id);
		}
		for (const update of competitionUpdates) {
			await ctx.db.delete("competitionUpdates", update._id);
		}

		await ctx.db.delete("competitions", args.competitionId);
		return null;
	},
});
