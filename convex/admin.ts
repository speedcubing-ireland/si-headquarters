import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const DIRECTORS_TEAM_NAME = "Directors";

type AuthCtx = QueryCtx | MutationCtx;

export async function isDirectorForCtx(ctx: AuthCtx): Promise<boolean> {
	const userId = await getAuthUserId(ctx);
	if (userId === null) return false;

	const team = await ctx.db
		.query("teams")
		.withIndex("by_name", (q) => q.eq("name", DIRECTORS_TEAM_NAME))
		.unique();

	if (!team) return false;

	return team.memberIds.includes(userId);
}

export async function requireDirector(ctx: AuthCtx): Promise<void> {
	const isDirector = await isDirectorForCtx(ctx);
	if (!isDirector) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Directors only.",
		});
	}
}

export const isDirector = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		return await isDirectorForCtx(ctx);
	},
});

const adminUserShape = v.object({
	id: v.string(),
	name: v.string(),
	avatarUrl: v.string(),
	teamIds: v.array(v.id("teams")),
});

const adminTeamShape = v.object({
	id: v.string(),
	name: v.string(),
	memberIds: v.array(v.id("users")),
});

export const listMembersAndTeams = query({
	args: {},
	returns: v.object({
		users: v.array(adminUserShape),
		teams: v.array(adminTeamShape),
	}),
	handler: async (ctx) => {
		await requireDirector(ctx);

		const [userDocs, teamDocs] = await Promise.all([
			ctx.db.query("users").collect(),
			ctx.db.query("teams").withIndex("by_name").order("asc").collect(),
		]);

		const users = userDocs.map((u) => ({
			id: u._id as Id<"users">,
			name: u.name ?? "",
			avatarUrl: u.image ?? "",
			teamIds: [] as string[],
		}));

		const userTeamIds = new Map<Id<"users">, Id<"teams">[]>();
		for (const team of teamDocs) {
			for (const memberId of team.memberIds) {
				const arr = userTeamIds.get(memberId) ?? [];
				arr.push(team._id as Id<"teams">);
				userTeamIds.set(memberId, arr);
			}
		}

		const usersWithTeams = users.map((u) => ({
			...u,
			teamIds: userTeamIds.get(u.id as Id<"users">) ?? [],
		}));

		const teams = teamDocs.map((t) => ({
			id: t._id,
			name: t.name,
			memberIds: t.memberIds,
		}));

		return { users: usersWithTeams, teams };
	},
});

export const updateTeamMembers = mutation({
	args: {
		teamId: v.id("teams"),
		memberIds: v.array(v.id("users")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);

		const team = await ctx.db.get("teams", args.teamId);
		if (!team) return null;

		await ctx.db.patch("teams", args.teamId, {
			memberIds: args.memberIds,
		});

		return null;
	},
});

const adminLabelShape = v.object({
	id: v.string(),
	name: v.string(),
	color: v.string(),
	archived: v.boolean(),
	usageCount: v.number(),
});

const adminPhaseShape = v.object({
	id: v.string(),
	key: v.string(),
	name: v.string(),
	description: v.string(),
	order: v.number(),
	archived: v.boolean(),
	taskUsageCount: v.number(),
	competitionUsageCount: v.number(),
});

export const listLabelsWithUsage = query({
	args: {},
	returns: v.array(adminLabelShape),
	handler: async (ctx) => {
		await requireDirector(ctx);

		const labels = await ctx.db
			.query("labels")
			.withIndex("by_name")
			.order("asc")
			.collect();

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_archived", (q) => q.eq("archived", false))
			.collect();

		const usage = new Map<Id<"labels">, number>();
		for (const task of tasks) {
			for (const lid of task.labelIds ?? []) {
				usage.set(lid, (usage.get(lid) ?? 0) + 1);
			}
		}

		return labels.map((l) => ({
			id: l._id as Id<"labels">,
			name: l.name,
			color: l.color,
			archived: l.archived,
			usageCount: usage.get(l._id as Id<"labels">) ?? 0,
		}));
	},
});

export const archiveLabel = mutation({
	args: { id: v.id("labels") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const doc = await ctx.db.get("labels", args.id);
		if (!doc) return null;
		await ctx.db.patch("labels", args.id, { archived: true });
		return null;
	},
});

export const unarchiveLabel = mutation({
	args: { id: v.id("labels") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const doc = await ctx.db.get("labels", args.id);
		if (!doc) return null;
		await ctx.db.patch("labels", args.id, { archived: false });
		return null;
	},
});

export const updateLabelAdmin = mutation({
	args: {
		id: v.id("labels"),
		name: v.optional(v.string()),
		color: v.optional(v.string()),
		archived: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const { id, ...updates } = args;
		const doc = await ctx.db.get("labels", id);
		if (!doc) return null;
		await ctx.db.patch("labels", id, updates);
		return null;
	},
});

export const deleteLabelIfUnused = mutation({
	args: { id: v.id("labels") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_archived", (q) => q.eq("archived", false))
			.collect();

		for (const task of tasks) {
			if (task.labelIds?.includes(args.id)) {
				throw new ConvexError({
					code: "FORBIDDEN",
					message:
						"Cannot delete label that is still used by at least one task. Remove it from all tasks first.",
				});
			}
		}

		await ctx.db.delete("labels", args.id);
		return null;
	},
});

export const listPhasesWithUsage = query({
	args: {},
	returns: v.array(adminPhaseShape),
	handler: async (ctx) => {
		await requireDirector(ctx);

		const [phases, tasks, competitions] = await Promise.all([
			ctx.db.query("phases").withIndex("by_order").order("asc").collect(),
			ctx.db
				.query("tasks")
				.withIndex("by_archived", (q) => q.eq("archived", false))
				.collect(),
			ctx.db.query("competitions").collect(),
		]);

		const taskUsage = new Map<Id<"phases">, number>();
		for (const task of tasks) {
			if (task.phaseId) {
				const current = taskUsage.get(task.phaseId as Id<"phases">) ?? 0;
				taskUsage.set(task.phaseId as Id<"phases">, current + 1);
			}
		}

		const competitionUsage = new Map<Id<"phases">, number>();
		for (const comp of competitions) {
			if (comp.currentPhaseId) {
				const current =
					competitionUsage.get(comp.currentPhaseId as Id<"phases">) ?? 0;
				competitionUsage.set(comp.currentPhaseId as Id<"phases">, current + 1);
			}
		}

		return phases.map((p) => ({
			id: p._id as Id<"phases">,
			key: p.key,
			name: p.name,
			description: p.description,
			order: p.order,
			archived: p.archived,
			taskUsageCount: taskUsage.get(p._id as Id<"phases">) ?? 0,
			competitionUsageCount: competitionUsage.get(p._id as Id<"phases">) ?? 0,
		}));
	},
});

export const createPhaseAdmin = mutation({
	args: {
		key: v.string(),
		name: v.string(),
		description: v.string(),
		order: v.optional(v.number()),
		archived: v.optional(v.boolean()),
	},
	returns: v.id("phases"),
	handler: async (ctx, args) => {
		await requireDirector(ctx);

		const existing = await ctx.db.query("phases").collect();
		const nextOrder =
			args.order ??
			(existing.length > 0 ? Math.max(...existing.map((p) => p.order)) + 1 : 0);

		return await ctx.db.insert("phases", {
			key: args.key,
			name: args.name,
			description: args.description,
			order: nextOrder,
			archived: args.archived ?? false,
		});
	},
});

export const updatePhaseAdmin = mutation({
	args: {
		id: v.id("phases"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		order: v.optional(v.number()),
		archived: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const { id, ...updates } = args;

		const patch: Record<string, unknown> = {};
		if (updates.name !== undefined) patch.name = updates.name;
		if (updates.description !== undefined)
			patch.description = updates.description;
		if (updates.order !== undefined) patch.order = updates.order;
		if (updates.archived !== undefined) patch.archived = updates.archived;

		if (Object.keys(patch).length === 0) return null;

		await ctx.db.patch("phases", id, patch);
		return null;
	},
});

export const deletePhaseIfUnused = mutation({
	args: { id: v.id("phases") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);

		const [tasks, competitions] = await Promise.all([
			ctx.db
				.query("tasks")
				.withIndex("by_archived", (q) => q.eq("archived", false))
				.collect(),
			ctx.db.query("competitions").collect(),
		]);

		for (const task of tasks) {
			if (task.phaseId === args.id) {
				throw new ConvexError({
					code: "FORBIDDEN",
					message:
						"Cannot delete phase that is still used by at least one task. Reassign it from those tasks first.",
				});
			}
		}

		for (const competition of competitions) {
			if (competition.currentPhaseId === args.id) {
				throw new ConvexError({
					code: "FORBIDDEN",
					message:
						"Cannot delete phase that is still the current phase of at least one competition. Update those competitions first.",
				});
			}
		}

		await ctx.db.delete("phases", args.id);
		return null;
	},
});
