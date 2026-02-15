import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { TEAM_NAMES } from "./lib/constants";
import { normalizeEmail, validateEmail } from "./lib/sanitize";

const DIRECTORS_TEAM_NAME = TEAM_NAMES.DIRECTORS;
const COMPETITIONS_TEAM_NAME = TEAM_NAMES.COMPETITIONS;

type AuthCtx = QueryCtx | MutationCtx;

async function isUserOnNamedTeam(
	ctx: AuthCtx,
	userId: Id<"users">,
	teamName: string,
): Promise<boolean> {
	const team = await ctx.db
		.query("teams")
		.withIndex("by_name", (q) => q.eq("name", teamName))
		.unique();

	return team?.memberIds.includes(userId) ?? false;
}

export async function isDirectorForCtx(ctx: AuthCtx): Promise<boolean> {
	const userId = await getAuthUserId(ctx);
	if (userId === null) return false;

	return await isUserOnNamedTeam(ctx, userId, DIRECTORS_TEAM_NAME);
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

async function findUserIdByEmail(
	ctx: AuthCtx,
	email: string,
): Promise<Id<"users"> | null> {
	const exactMatch = await ctx.db
		.query("users")
		.withIndex("email", (q) => q.eq("email", email))
		.first();
	if (exactMatch) {
		return exactMatch._id;
	}

	const users = await ctx.db.query("users").withIndex("email").collect();
	const normalizedEmail = normalizeEmail(email);
	const match = users.find(
		(user) => normalizeEmail(user.email) === normalizedEmail,
	);
	return match?._id ?? null;
}

async function addMemberToTeamIfMissing(
	ctx: MutationCtx,
	teamId: Id<"teams">,
	userId: Id<"users">,
): Promise<void> {
	const team = await ctx.db.get("teams", teamId);
	if (!team) return;
	if (team.memberIds.includes(userId)) return;
	await ctx.db.patch("teams", teamId, {
		memberIds: [...team.memberIds, userId],
	});
}

export const isDirector = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		return await isDirectorForCtx(ctx);
	},
});

export const getIsDirectorInternal = internalQuery({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		return await isDirectorForCtx(ctx);
	},
});

export const canAccessWca2fa = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) return false;

		const [isDirector, isCompetitionsTeamMember] = await Promise.all([
			isUserOnNamedTeam(ctx, userId, DIRECTORS_TEAM_NAME),
			isUserOnNamedTeam(ctx, userId, COMPETITIONS_TEAM_NAME),
		]);

		return isDirector || isCompetitionsTeamMember;
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

const adminPendingTeamMemberShape = v.object({
	id: v.id("pendingTeamMembers"),
	email: v.string(),
	teamId: v.id("teams"),
	teamName: v.string(),
	createdAt: v.number(),
});

export const listMembersAndTeams = query({
	args: {},
	returns: v.object({
		users: v.array(adminUserShape),
		teams: v.array(adminTeamShape),
		pendingTeamMembers: v.array(adminPendingTeamMemberShape),
	}),
	handler: async (ctx) => {
		await requireDirector(ctx);

		const [userDocs, teamDocs, pendingTeamMemberDocs] = await Promise.all([
			ctx.db.query("users").withIndex("email").collect(),
			ctx.db.query("teams").withIndex("by_name").order("asc").collect(),
			ctx.db
				.query("pendingTeamMembers")
				.withIndex("by_team_and_email")
				.collect(),
		]);

		const users = userDocs.map((u) => ({
			id: u._id,
			name: u.name ?? "",
			avatarUrl: u.image ?? "",
			teamIds: [] as string[],
		}));

		const userTeamIds = new Map<Id<"users">, Id<"teams">[]>();
		for (const team of teamDocs) {
			for (const memberId of team.memberIds) {
				const arr = userTeamIds.get(memberId) ?? [];
				arr.push(team._id);
				userTeamIds.set(memberId, arr);
			}
		}

		const usersWithTeams = users.map((u) => ({
			...u,
			teamIds: userTeamIds.get(u.id) ?? [],
		}));

		const teams = teamDocs.map((t) => ({
			id: t._id,
			name: t.name,
			memberIds: t.memberIds,
		}));

		const teamNameById = new Map<Id<"teams">, string>(
			teamDocs.map((team) => [team._id, team.name]),
		);
		const pendingTeamMembers = pendingTeamMemberDocs
			.map((row) => {
				const teamName = teamNameById.get(row.teamId);
				if (!teamName) return null;
				return {
					id: row._id,
					email: row.email,
					teamId: row.teamId,
					teamName,
					createdAt: row.createdAt,
				};
			})
			.filter((row) => row !== null)
			.sort((a, b) => {
				const teamSort = a.teamName.localeCompare(b.teamName);
				if (teamSort !== 0) return teamSort;
				return a.email.localeCompare(b.email);
			});

		return { users: usersWithTeams, teams, pendingTeamMembers };
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

export const addPendingTeamMember = mutation({
	args: {
		teamId: v.id("teams"),
		email: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);

		const normalizedEmail = normalizeEmail(args.email);
		if (!normalizedEmail || !validateEmail(normalizedEmail)) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Enter a valid email address.",
			});
		}

		const team = await ctx.db.get("teams", args.teamId);
		if (!team) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Team not found.",
			});
		}

		const existingUserId = await findUserIdByEmail(ctx, normalizedEmail);
		if (existingUserId) {
			await addMemberToTeamIfMissing(ctx, args.teamId, existingUserId);
		}

		const existingPending = await ctx.db
			.query("pendingTeamMembers")
			.withIndex("by_team_and_email", (q) =>
				q.eq("teamId", args.teamId).eq("email", normalizedEmail),
			)
			.unique();

		if (existingUserId) {
			if (existingPending) {
				await ctx.db.delete("pendingTeamMembers", existingPending._id);
			}
			return null;
		}

		if (existingPending) return null;

		const createdById = await getAuthUserId(ctx);
		if (!createdById) {
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Authentication required",
			});
		}

		await ctx.db.insert("pendingTeamMembers", {
			email: normalizedEmail,
			teamId: args.teamId,
			createdById,
			createdAt: Date.now(),
		});

		return null;
	},
});

export const removePendingTeamMember = mutation({
	args: {
		pendingTeamMemberId: v.id("pendingTeamMembers"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const row = await ctx.db.get(
			"pendingTeamMembers",
			args.pendingTeamMemberId,
		);
		if (!row) return null;
		await ctx.db.delete("pendingTeamMembers", args.pendingTeamMemberId);
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
			id: l._id,
			name: l.name,
			color: l.color,
			archived: l.archived,
			usageCount: usage.get(l._id) ?? 0,
		}));
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

		const phases = await ctx.db
			.query("phases")
			.withIndex("by_order")
			.order("asc")
			.collect();

		const usageEntries = await Promise.all(
			phases.map(
				async (
					phase,
				): Promise<
					[
						Id<"phases">,
						{ taskUsageCount: number; competitionUsageCount: number },
					]
				> => {
					const [taskDocs, competitionDocs] = await Promise.all([
						ctx.db
							.query("tasks")
							.withIndex("by_phase_and_archived", (q) =>
								q.eq("phaseId", phase._id).eq("archived", false),
							)
							.collect(),
						ctx.db
							.query("competitions")
							.withIndex("by_current_phase", (q) =>
								q.eq("currentPhaseId", phase._id),
							)
							.collect(),
					]);
					return [
						phase._id,
						{
							taskUsageCount: taskDocs.length,
							competitionUsageCount: competitionDocs.length,
						},
					];
				},
			),
		);

		const usageByPhase = new Map<
			Id<"phases">,
			{ taskUsageCount: number; competitionUsageCount: number }
		>(usageEntries);

		return phases.map((p) => ({
			id: p._id,
			key: p.key,
			name: p.name,
			description: p.description,
			order: p.order,
			archived: p.archived,
			taskUsageCount: usageByPhase.get(p._id)?.taskUsageCount ?? 0,
			competitionUsageCount:
				usageByPhase.get(p._id)?.competitionUsageCount ?? 0,
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

		const lastPhase = await ctx.db
			.query("phases")
			.withIndex("by_order")
			.order("desc")
			.first();
		const nextOrder = args.order ?? (lastPhase ? lastPhase.order + 1 : 0);

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

		const patch: Partial<typeof updates> = {};
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

		const taskUsingPhase = await ctx.db
			.query("tasks")
			.withIndex("by_phase_and_archived", (q) =>
				q.eq("phaseId", args.id).eq("archived", false),
			)
			.first();
		if (taskUsingPhase) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message:
					"Cannot delete phase that is still used by at least one task. Reassign it from those tasks first.",
			});
		}

		const competitionUsingPhase = await ctx.db
			.query("competitions")
			.withIndex("by_current_phase", (q) => q.eq("currentPhaseId", args.id))
			.first();
		if (competitionUsingPhase) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message:
					"Cannot delete phase that is still the current phase of at least one competition. Update those competitions first.",
			});
		}

		await ctx.db.delete("phases", args.id);
		return null;
	},
});
