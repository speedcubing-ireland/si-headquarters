import { v, ConvexError } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUserId, isVolunteer } from "./auth";
import {
	collectAllTaskIdsRecursively,
	deleteTasksAndRelatedData,
	deleteCommentsAndReplies,
} from "./lib/taskDeletion";
import {
	deleteEntitySubscriptions,
	deleteNotificationArtifactsForEntity,
} from "./notifications/lib/cleanup";
import {
	competitionAccessUserIds,
	deleteCompetitionAccessRows,
	listAccessibleCompetitionIds,
	syncCompetitionAccessRows,
	userCanAccessCompetitionDoc,
} from "./competitionAccess";
import { toUsers, createLens, toISO, type UserUI } from "./lib/transforms";
import { phaseShape, taskStatus, userShape } from "./lib/validators";
import type { TaskStatus } from "./lib/types";
import { sendCompetitionPhaseChangeNotifications } from "./notifications/triggers/competitions";
import {
	competitionSponsorPropertyStatus,
	isSealedAuctionFramework,
} from "./lib/sponsorshipValidators";

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
	wcaCompetitionId: v.optional(v.string()),
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
type CompetitionSponsorProperty = {
	sponsorPropertyStatus: "not_offered" | "bidding" | "none" | "sponsor";
	sponsorPropertyDisplay?: string;
	sponsorWinningBidCents?: number;
};

function buildCompetitionSponsorProperty(input: {
	auctions: Doc<"sponsorshipAuctions">[];
	winnerNameById: Map<Id<"sponsors">, string>;
}): CompetitionSponsorProperty {
	const hasLiveAuction = input.auctions.some(
		(auction) => auction.state === "active" || auction.state === "scheduled",
	);
	if (hasLiveAuction) {
		return {
			sponsorPropertyStatus: "bidding",
		};
	}

	const latestClosed = input.auctions
		.filter((auction) => auction.state === "closed")
		.sort((a, b) => b.endsAt - a.endsAt)[0];
	if (!latestClosed) {
		return {
			sponsorPropertyStatus: "not_offered",
		};
	}
	if (!latestClosed.winnerSponsorId) {
		return {
			sponsorPropertyStatus: "none",
		};
	}

	return {
		sponsorPropertyStatus: "sponsor",
		sponsorPropertyDisplay: input.winnerNameById.get(
			latestClosed.winnerSponsorId,
		),
		sponsorWinningBidCents: isSealedAuctionFramework(latestClosed.framework)
			? (latestClosed.settlementAmountCents ??
				latestClosed.currentPriceCents ??
				latestClosed.startPriceCents)
			: undefined,
	};
}

async function loadCompetitionSponsorProperty(
	ctx: QueryCtx,
	competitionId: Id<"competitions">,
): Promise<CompetitionSponsorProperty> {
	const auctions = await ctx.db
		.query("sponsorshipAuctions")
		.withIndex("by_competition", (q) => q.eq("competitionId", competitionId))
		.collect();
	const winnerIds = new Set<Id<"sponsors">>();
	for (const auction of auctions) {
		if (auction.winnerSponsorId) {
			winnerIds.add(auction.winnerSponsorId);
		}
	}
	const winnerSponsors = await Promise.all(
		[...winnerIds].map((sponsorId) => ctx.db.get("sponsors", sponsorId)),
	);
	const winnerNameById = new Map<Id<"sponsors">, string>();
	for (const sponsor of winnerSponsors) {
		if (!sponsor) continue;
		winnerNameById.set(sponsor._id, sponsor.name);
	}

	return buildCompetitionSponsorProperty({
		auctions,
		winnerNameById,
	});
}

async function loadCompetitionSponsorProperties(
	ctx: QueryCtx,
	competitionIds: Id<"competitions">[],
): Promise<Map<Id<"competitions">, CompetitionSponsorProperty>> {
	const competitionIdSet = new Set(competitionIds);
	if (competitionIdSet.size === 0) {
		return new Map();
	}

	const allAuctions = await ctx.db.query("sponsorshipAuctions").collect();
	const auctionsByCompetition = new Map<
		Id<"competitions">,
		Doc<"sponsorshipAuctions">[]
	>();
	for (const auction of allAuctions) {
		if (!competitionIdSet.has(auction.competitionId)) continue;
		const existing = auctionsByCompetition.get(auction.competitionId);
		if (existing) {
			existing.push(auction);
			continue;
		}
		auctionsByCompetition.set(auction.competitionId, [auction]);
	}
	const winnerIds = new Set<Id<"sponsors">>();
	for (const auctions of auctionsByCompetition.values()) {
		for (const auction of auctions) {
			if (auction.winnerSponsorId) {
				winnerIds.add(auction.winnerSponsorId);
			}
		}
	}
	const winnerSponsors = await Promise.all(
		[...winnerIds].map((sponsorId) => ctx.db.get("sponsors", sponsorId)),
	);
	const winnerNameById = new Map<Id<"sponsors">, string>();
	for (const sponsor of winnerSponsors) {
		if (!sponsor) continue;
		winnerNameById.set(sponsor._id, sponsor.name);
	}

	const sponsorProperties = new Map<
		Id<"competitions">,
		CompetitionSponsorProperty
	>();
	for (const competitionId of competitionIdSet) {
		sponsorProperties.set(
			competitionId,
			buildCompetitionSponsorProperty({
				auctions: auctionsByCompetition.get(competitionId) ?? [],
				winnerNameById,
			}),
		);
	}
	return sponsorProperties;
}

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
	wcaCompetitionId: v.union(v.string(), v.null()),
	sponsorPropertyStatus: competitionSponsorPropertyStatus,
	sponsorPropertyDisplay: v.optional(v.string()),
	sponsorWinningBidCents: v.optional(v.number()),
	tasks: v.array(taskSummaryShape),
	createdAt: v.string(),
	updatedAt: v.string(),
});

export const getInternal = internalQuery({
	args: { id: v.id("competitions") },
	returns: v.union(competitionDoc, v.null()),
	handler: async (ctx, args) => {
		return await ctx.db.get("competitions", args.id);
	},
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

interface ActivePhases {
	phasesForUI: { id: Id<"phases">; name: string; description: string }[];
	defaultPhaseId: Id<"phases"> | undefined;
}

async function loadActivePhases(ctx: QueryCtx): Promise<ActivePhases> {
	const phases = await ctx.db
		.query("phases")
		.withIndex("by_order")
		.order("asc")
		.collect();
	const orderedPhases = phases.filter((p) => !p.archived);
	return {
		phasesForUI: orderedPhases.map((p) => ({
			id: p._id,
			name: p.name,
			description: p.description,
		})),
		defaultPhaseId: orderedPhases[0]?._id,
	};
}

function buildCompetitionUI(
	d: Doc<"competitions">,
	usersLens: ReturnType<typeof createLens<UserUI>>,
	phases: ActivePhases,
	tasks: TaskSummary[],
	updateDocs: Doc<"competitionUpdates">[],
	sponsorProperty: CompetitionSponsorProperty,
) {
	const currentPhaseId = d.currentPhaseId ?? phases.defaultPhaseId;
	const currentPhaseIdx =
		currentPhaseId != null
			? phases.phasesForUI.findIndex((p) => p.id === currentPhaseId)
			: 0;
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
		phases: phases.phasesForUI,
		currentPhaseIdx: currentPhaseIdx >= 0 ? currentPhaseIdx : 0,
		progressUpdates: buildProgressUpdatesForUI(updateDocs, usersLens),
		compSheet: d.compSheet ?? null,
		wcaCompetitionId: d.wcaCompetitionId ?? null,
		sponsorPropertyStatus: sponsorProperty.sponsorPropertyStatus,
		sponsorPropertyDisplay: sponsorProperty.sponsorPropertyDisplay,
		sponsorWinningBidCents: sponsorProperty.sponsorWinningBidCents,
		tasks,
		createdAt: toISO(d._creationTime),
		updatedAt: toISO(d.updatedAt),
	};
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
			const accessibleCompetitionIds = await listAccessibleCompetitionIds(
				ctx,
				userId,
			);
			const competitionDocs = await Promise.all(
				accessibleCompetitionIds.map((competitionId) =>
					ctx.db.get("competitions", competitionId),
				),
			);
			docs = competitionDocs
				.filter(
					(competition): competition is Doc<"competitions"> =>
						competition !== null,
				)
				.sort((a, b) => a.compStart.localeCompare(b.compStart));
		}

		const phases = await loadActivePhases(ctx);

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
		const userDocs = await Promise.all(
			userArr.map((id) => ctx.db.get("users", id)),
		);
		const usersLens = createLens(toUsers(userDocs));
		const sponsorPropertiesByCompetition =
			await loadCompetitionSponsorProperties(
				ctx,
				docs.map((d) => d._id),
			);

		return docs.map((d) =>
			buildCompetitionUI(
				d,
				usersLens,
				phases,
				tasksByCompetition.get(d._id) ?? [],
				updatesByCompetition.get(d._id) ?? [],
				sponsorPropertiesByCompetition.get(d._id) ?? {
					sponsorPropertyStatus: "not_offered",
				},
			),
		);
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

		const phases = await loadActivePhases(ctx);

		const userIds = new Set<Id<"users">>();
		if (d.compLeadId) userIds.add(d.compLeadId);
		if (d.leadDelegateId) userIds.add(d.leadDelegateId);
		for (const id of d.organiserIds) userIds.add(id);

		const [updateDocs, tasks] = await Promise.all([
			ctx.db
				.query("competitionUpdates")
				.withIndex("by_competition", (q) =>
					q.eq("competitionId", args.competitionId),
				)
				.order("desc")
				.collect(),
			loadTaskSummariesForCompetition(ctx, args.competitionId),
		]);
		collectUserIdsFromUpdates(updateDocs, userIds);

		const userArr = [...userIds];
		const userDocs = await Promise.all(
			userArr.map((id) => ctx.db.get("users", id)),
		);
		const usersLens = createLens(toUsers(userDocs));
		const sponsorProperty = await loadCompetitionSponsorProperty(
			ctx,
			args.competitionId,
		);

		return buildCompetitionUI(
			d,
			usersLens,
			phases,
			tasks,
			updateDocs,
			sponsorProperty,
		);
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
	wcaCompetitionId: v.optional(v.string()),
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

		const { defaultPhaseId } = await loadActivePhases(ctx);

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
			wcaCompetitionId: args.wcaCompetitionId,
			updatedAt: now,
		});
		await syncCompetitionAccessRows(
			ctx,
			competitionId,
			competitionAccessUserIds({
				compLeadId: args.compLeadId,
				leadDelegateId: args.leadDelegateId,
				organiserIds: args.organiserIds ?? [],
			}),
		);
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
	wcaCompetitionId: v.optional(v.union(v.string(), v.null())),
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
	wcaCompetitionId?: string | null;
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
	if (updates.wcaCompetitionId !== undefined)
		patch.wcaCompetitionId = updates.wcaCompetitionId ?? undefined;
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
		const hasAccessFieldUpdate =
			args.updates.compLeadId !== undefined ||
			args.updates.leadDelegateId !== undefined ||
			args.updates.organiserIds !== undefined;

		await ctx.db.patch("competitions", args.competitionId, patch);
		if (hasAccessFieldUpdate) {
			await syncCompetitionAccessRows(
				ctx,
				args.competitionId,
				competitionAccessUserIds({
					compLeadId:
						args.updates.compLeadId === undefined
							? doc.compLeadId
							: (args.updates.compLeadId ?? undefined),
					leadDelegateId:
						args.updates.leadDelegateId === undefined
							? doc.leadDelegateId
							: (args.updates.leadDelegateId ?? undefined),
					organiserIds: args.updates.organiserIds ?? doc.organiserIds,
				}),
			);
		}

		if (!phaseTransition.hasPhaseChange) {
			return null;
		}

		const [oldPhaseName, newPhaseName] = await Promise.all([
			loadPhaseName(ctx, phaseTransition.oldPhaseId),
			loadPhaseName(ctx, phaseTransition.newPhaseId),
		]);

		await sendCompetitionPhaseChangeNotifications(ctx, {
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
		await deleteCompetitionAccessRows(ctx, args.competitionId);

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

		await deleteNotificationArtifactsForEntity(ctx, {
			entityType: "competition",
			entityId: `${args.competitionId}`,
		});
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
