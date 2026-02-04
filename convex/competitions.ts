import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUserId } from "./auth";

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
	progressUpdates: v.array(v.any()),
	compSheet: v.union(compSheetObject, v.null()),
	tasks: v.array(v.any()),
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
		await requireUserId(ctx);
		return await ctx.db.get("competitions", args.competitionId);
	},
});

function toISO(ms: number): string {
	return new Date(ms).toISOString();
}

export const listForUI = query({
	args: {},
	returns: v.array(competitionForUIReturns),
	handler: async (ctx) => {
		await requireUserId(ctx);
		const docs: Doc<"competitions">[] = await ctx.db
			.query("competitions")
			.withIndex("by_comp_start")
			.order("asc")
			.collect();

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
		for (const d of docs) {
			if (d.compLeadId) userIds.add(d.compLeadId);
			if (d.leadDelegateId) userIds.add(d.leadDelegateId);
			for (const id of d.organiserIds) userIds.add(id);
		}

		const userArr = [...userIds];
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
					.filter(
						(u): u is { id: string; name: string; avatarUrl: string } =>
							Boolean(u),
					),
				phases: phasesForUI,
				currentPhaseIdx: currentPhaseIdx >= 0 ? currentPhaseIdx : 0,
				progressUpdates: [],
				compSheet: d.compSheet ?? null,
				tasks: [],
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
		await requireUserId(ctx);
		const d = await ctx.db.get("competitions", args.competitionId);
		if (!d) return null;

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

		const userArr = [...userIds];
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
				.filter(
					(u): u is { id: string; name: string; avatarUrl: string } =>
						Boolean(u),
				),
			phases: phasesForUI,
			currentPhaseIdx: currentPhaseIdx >= 0 ? currentPhaseIdx : 0,
			progressUpdates: [],
			compSheet: d.compSheet ?? null,
			tasks: [],
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
		await requireUserId(ctx);
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
		await requireUserId(ctx);
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

		await ctx.db.patch(
			"competitions",
			args.competitionId,
			patch as Record<string, unknown>,
		);
		return null;
	},
});

export const remove = mutation({
	args: { competitionId: v.id("competitions") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		const doc = await ctx.db.get("competitions", args.competitionId);
		if (!doc) return null;
		await ctx.db.delete("competitions", args.competitionId);
		return null;
	},
});
