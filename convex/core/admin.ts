import { ConvexError, v } from "convex/values";
import { components } from "../_generated/api";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	canAccessWca2faForCtx,
	canAccessSocialMediaDashboardForCtx,
	getPermissionSnapshot as getPermissionSnapshotForCtx,
	isDelegateForCtx,
	isDirectorForCtx,
	requirePermission,
	PERMISSION_KEYS,
} from "../lib/permissions/policies";
import { requireAuthenticatedUserId } from "../lib/permissions/authn";
import { normalizeEmail, validateEmail } from "../lib/sanitize";
import { ensureSponsorAuthAccount } from "../sponsorship/authAccounts";

type AuthCtx = QueryCtx | MutationCtx;
type ImpersonationTargetType = "user" | "sponsor";

const IMPERSONATION_TICKET_TTL_MS = 5 * 60 * 1000;
const IMPERSONATION_SESSION_TTL_MS = 60 * 60 * 1000;
const SPONSOR_OTT_TTL_MS = 3 * 60 * 1000;
const MIN_CONSUMPTION_NONCE_LENGTH = 16;
const INVALID_IMPERSONATION_LINK_MESSAGE =
	"Invalid or expired impersonation link.";
const EXCLUSIVE_TARGET_ID_MESSAGE =
	"Provide either user id or sponsor id, not both, for impersonation.";

export { isDirectorForCtx } from "../lib/permissions/policies";

export async function requireDirector(ctx: AuthCtx): Promise<void> {
	await requirePermission(ctx, PERMISSION_KEYS.DIRECTOR);
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

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function generateSecureToken(byteLength = 32): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return bytesToHex(bytes);
}

async function sha256Hex(value: string): Promise<string> {
	const encoded = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", encoded);
	return bytesToHex(new Uint8Array(digest));
}

function resolveSiteUrl(): string {
	const siteUrl =
		process.env.SITE_URL ??
		(process.env.NODE_ENV === "production"
			? "https://hq.speedcubing.ie"
			: "http://localhost:5173");
	return siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
}

type AdminImpersonationTicket = Doc<"adminImpersonationTickets">;

function throwInvalidImpersonationLink(): never {
	throw new ConvexError({
		code: "UNAUTHENTICATED",
		message: INVALID_IMPERSONATION_LINK_MESSAGE,
	});
}

function normalizeConsumptionNonce(consumptionNonce: string): string {
	const normalized = consumptionNonce.trim();
	if (normalized.length < MIN_CONSUMPTION_NONCE_LENGTH) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Invalid login request.",
		});
	}
	return normalized;
}

async function getConsumableTicketByToken(
	ctx: MutationCtx,
	ticket: string,
	consumedByNonceHash: string,
): Promise<{
	ticket: AdminImpersonationTicket;
	alreadyConsumedByNonce: boolean;
}> {
	const trimmed = ticket.trim();
	if (trimmed.length < 32) {
		throwInvalidImpersonationLink();
	}
	const tokenHash = await sha256Hex(trimmed);
	const row = await ctx.db
		.query("adminImpersonationTickets")
		.withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
		.unique();
	if (!row || row.expiresAt < Date.now()) {
		throwInvalidImpersonationLink();
	}
	if (row.usedAt === undefined) {
		return { ticket: row, alreadyConsumedByNonce: false };
	}
	if (row.consumedByNonceHash === consumedByNonceHash) {
		return { ticket: row, alreadyConsumedByNonce: true };
	}
	throwInvalidImpersonationLink();
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

export const getIsDelegateInternal = internalQuery({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		return await isDelegateForCtx(ctx);
	},
});

export const canAccessWca2fa = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		return canAccessWca2faForCtx(ctx);
	},
});

const permissionSnapshotShape = v.object({
	isDirector: v.boolean(),
	isDelegate: v.boolean(),
	isVolunteer: v.boolean(),
	canAccessWca2fa: v.boolean(),
	isSponsorshipManager: v.boolean(),
	canAccessSocialMediaDashboard: v.boolean(),
});

export const getPermissionSnapshot = query({
	args: {},
	returns: permissionSnapshotShape,
	handler: async (ctx) => {
		return getPermissionSnapshotForCtx(ctx);
	},
});

export const canAccessSocialMediaDashboard = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		return canAccessSocialMediaDashboardForCtx(ctx);
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

		const createdById = await requireAuthenticatedUserId(ctx);

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

const impersonationUserShape = v.object({
	id: v.id("users"),
	name: v.string(),
	email: v.string(),
});

const impersonationSponsorShape = v.object({
	id: v.id("sponsors"),
	name: v.string(),
	email: v.string(),
	active: v.boolean(),
});

export const listImpersonationTargets = query({
	args: {},
	returns: v.object({
		users: v.array(impersonationUserShape),
		sponsors: v.array(impersonationSponsorShape),
	}),
	handler: async (ctx) => {
		await requireDirector(ctx);

		const [users, sponsors] = await Promise.all([
			ctx.db.query("users").withIndex("email").collect(),
			ctx.db.query("sponsors").withIndex("by_name").order("asc").collect(),
		]);

		return {
			users: users
				.map((user) => ({
					id: user._id,
					name: user.name?.trim() || "Unnamed user",
					email: user.email?.trim() || "",
				}))
				.sort((a, b) => {
					const nameSort = a.name.localeCompare(b.name);
					if (nameSort !== 0) return nameSort;
					return a.email.localeCompare(b.email);
				}),
			sponsors: sponsors.map((sponsor) => ({
				id: sponsor._id,
				name: sponsor.name,
				email: sponsor.email,
				active: sponsor.active,
			})),
		};
	},
});

const createImpersonationLinkArgs = v.object({
	targetType: v.union(v.literal("user"), v.literal("sponsor")),
	userId: v.optional(v.id("users")),
	sponsorId: v.optional(v.id("sponsors")),
});

export const createImpersonationLoginLink = mutation({
	args: createImpersonationLinkArgs,
	returns: v.object({
		url: v.string(),
		expiresAt: v.number(),
		targetType: v.union(v.literal("user"), v.literal("sponsor")),
		targetName: v.string(),
		targetEmail: v.string(),
	}),
	handler: async (ctx, args) => {
		const actorId = await requirePermission(ctx, PERMISSION_KEYS.DIRECTOR);
		const now = Date.now();
		const expiresAt = now + IMPERSONATION_TICKET_TTL_MS;
		const ticket = generateSecureToken(32);
		const tokenHash = await sha256Hex(ticket);
		const siteUrl = resolveSiteUrl();

		let targetType: ImpersonationTargetType;
		let targetName: string;
		let targetEmail: string;

		if (args.targetType === "user") {
			if (!args.userId) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: "User id is required for user impersonation.",
				});
			}
			if (args.sponsorId) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: EXCLUSIVE_TARGET_ID_MESSAGE,
				});
			}
			const user = await ctx.db.get("users", args.userId);
			if (!user) {
				throw new ConvexError({
					code: "NOT_FOUND",
					message: "User not found.",
				});
			}

			targetType = "user";
			targetName = user.name?.trim() || "Unnamed user";
			targetEmail = user.email?.trim() || "";

			await ctx.db.insert("adminImpersonationTickets", {
				tokenHash,
				targetType,
				userId: user._id,
				createdById: actorId,
				createdAt: now,
				expiresAt,
			});
		} else {
			if (!args.sponsorId) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: "Sponsor id is required for sponsor impersonation.",
				});
			}
			if (args.userId) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: EXCLUSIVE_TARGET_ID_MESSAGE,
				});
			}
			const sponsor = await ctx.db.get("sponsors", args.sponsorId);
			if (!sponsor || !sponsor.active) {
				throw new ConvexError({
					code: "NOT_FOUND",
					message: "Active sponsor not found.",
				});
			}
			const { authUserId } = await ensureSponsorAuthAccount(ctx, {
				sponsor,
				updatedById: actorId,
			});

			targetType = "sponsor";
			targetName = sponsor.name;
			targetEmail = sponsor.email;

			await ctx.db.insert("adminImpersonationTickets", {
				tokenHash,
				targetType,
				sponsorId: sponsor._id,
				sponsorAuthUserId: authUserId,
				createdById: actorId,
				createdAt: now,
				expiresAt,
			});
		}

		const url = new URL("/auth/login-ticket", siteUrl);
		url.searchParams.set("ticket", ticket);
		url.searchParams.set("kind", targetType);

		return {
			url: url.toString(),
			expiresAt,
			targetType,
			targetName,
			targetEmail,
		};
	},
});

export const consumeUserImpersonationTicket = internalMutation({
	args: { ticket: v.string(), consumptionNonce: v.string() },
	returns: v.object({ userId: v.id("users") }),
	handler: async (ctx, args) => {
		const consumptionNonce = normalizeConsumptionNonce(args.consumptionNonce);
		const consumedByNonceHash = await sha256Hex(consumptionNonce);
		const { ticket: row, alreadyConsumedByNonce } =
			await getConsumableTicketByToken(ctx, args.ticket, consumedByNonceHash);
		if (row.targetType !== "user" || !row.userId) {
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Invalid impersonation link.",
			});
		}

		const user = await ctx.db.get("users", row.userId);
		if (!user) {
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "User account no longer exists.",
			});
		}

		if (!alreadyConsumedByNonce) {
			await ctx.db.patch("adminImpersonationTickets", row._id, {
				usedAt: Date.now(),
				consumedByNonceHash,
			});
		}
		return { userId: row.userId };
	},
});

export const consumeSponsorImpersonationTicket = mutation({
	args: { ticket: v.string(), consumptionNonce: v.string() },
	returns: v.object({ oneTimeToken: v.string() }),
	handler: async (ctx, args) => {
		const consumptionNonce = normalizeConsumptionNonce(args.consumptionNonce);
		const consumedByNonceHash = await sha256Hex(consumptionNonce);
		const { ticket: row, alreadyConsumedByNonce } =
			await getConsumableTicketByToken(ctx, args.ticket, consumedByNonceHash);
		if (row.targetType !== "sponsor" || !row.sponsorId) {
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Invalid impersonation link.",
			});
		}

		const sponsor = await ctx.db.get("sponsors", row.sponsorId);
		if (!sponsor || !sponsor.active) {
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Sponsor account is inactive.",
			});
		}

		const sponsorAuthUserId = row.sponsorAuthUserId ?? sponsor.authUserId;
		if (!sponsorAuthUserId) {
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Sponsor auth account is unavailable.",
			});
		}

		const now = Date.now();
		const sessionToken = generateSecureToken(32);
		const oneTimeToken = await sha256Hex(
			`sponsor:${args.ticket.trim()}:${consumptionNonce}`,
		);

		if (alreadyConsumedByNonce) {
			return { oneTimeToken };
		}

		await ctx.runMutation(components.sponsorAuth.adapter.create, {
			input: {
				model: "session",
				data: {
					expiresAt: now + IMPERSONATION_SESSION_TTL_MS,
					token: sessionToken,
					createdAt: now,
					updatedAt: now,
					ipAddress: null,
					userAgent: "god-mode-impersonation",
					userId: sponsorAuthUserId,
				},
			},
		});

		await ctx.runMutation(components.sponsorAuth.adapter.create, {
			input: {
				model: "verification",
				data: {
					identifier: `one-time-token:${oneTimeToken}`,
					value: sessionToken,
					expiresAt: now + SPONSOR_OTT_TTL_MS,
					createdAt: now,
					updatedAt: now,
				},
			},
		});

		await ctx.db.patch("adminImpersonationTickets", row._id, {
			usedAt: now,
			consumedByNonceHash,
		});
		return { oneTimeToken };
	},
});
