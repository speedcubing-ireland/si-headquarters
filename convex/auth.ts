import Google from "@auth/core/providers/google";
import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { botttsNeutral } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import {
	internalQuery,
	query,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { TEAM_NAMES } from "./lib/constants";
import { normalizeEmail } from "./lib/sanitize";

function buildDefaultAvatarUrl(seed: string): string {
	return createAvatar(botttsNeutral, { seed }).toDataUri();
}

function hasAvatarImage(image: string | null | undefined): boolean {
	return typeof image === "string" && image.trim().length > 0;
}

function WCA(
	options: OAuthUserConfig<{
		id: number;
		email: string;
		created_at: string;
		updated_at: string;
	}>,
): OAuthConfig<{
	id: number;
	email: string;
	created_at: string;
	updated_at: string;
}> {
	return {
		id: "wca",
		name: "WCA",
		type: "oauth",
		checks: ["state"],
		authorization: {
			url: "https://www.worldcubeassociation.org/oauth/authorize",
			params: {
				scope: "public email",
			},
		},
		token: "https://www.worldcubeassociation.org/oauth/token",
		userinfo: "https://www.worldcubeassociation.org/api/v0/me",
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		profile(profile) {
			type WcaMe = {
				id: number;
				name?: string;
				email?: string;
				avatar?: { url?: string; thumb_url?: string };
			};
			const wcaUser = (profile as { me?: WcaMe }).me ?? (profile as WcaMe);
			return {
				id: String(wcaUser.id),
				name: wcaUser.name ?? wcaUser.email?.split("@")[0] ?? "WCA User",
				email: wcaUser.email,
				image: wcaUser.avatar?.url ?? wcaUser.avatar?.thumb_url,
			};
		},
	};
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
	providers: [
		Google({
			authorization: {
				params: {
					hd: "speedcubingireland.com",
				},
			},
		}),
		WCA({
			clientId: process.env.AUTH_WCA_ID,
			clientSecret: process.env.AUTH_WCA_SECRET,
		}),
	],
	callbacks: {
		async afterUserCreatedOrUpdated(ctx, args) {
			if (args.existingUserId !== null) {
				return;
			}

			const user = await ctx.db.get(args.userId);
			if (!user || hasAvatarImage(user.image)) {
				return;
			}

			await ctx.db.patch(args.userId, {
				image: buildDefaultAvatarUrl(String(args.userId)),
			});
		},
	},
});

const VOLUNTEER_TEAM_NAME = TEAM_NAMES.VOLUNTEER;

type AuthCtx = QueryCtx | MutationCtx;

export async function requireUserId(
	ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
	const userId = await getAuthUserId(ctx);
	if (userId === null) {
		throw new ConvexError({
			code: "UNAUTHENTICATED",
			message: "Authentication required",
		});
	}
	return userId;
}

export async function isVolunteer(ctx: AuthCtx): Promise<boolean> {
	const userId = await getAuthUserId(ctx);
	if (userId === null) return false;

	const team = await ctx.db
		.query("teams")
		.withIndex("by_name", (q) => q.eq("name", VOLUNTEER_TEAM_NAME))
		.unique();

	if (!team) return false;

	return team.memberIds.includes(userId);
}

export const getIsVolunteer = internalQuery({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => isVolunteer(ctx),
});

export const isVolunteerQuery = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => isVolunteer(ctx),
});

export async function ensureVolunteerTeam(
	ctx: MutationCtx,
): Promise<Id<"teams">> {
	const existing = await ctx.db
		.query("teams")
		.withIndex("by_name", (q) => q.eq("name", VOLUNTEER_TEAM_NAME))
		.unique();

	if (existing) {
		return existing._id;
	}

	return await ctx.db.insert("teams", {
		name: VOLUNTEER_TEAM_NAME,
		memberIds: [],
	});
}

export async function ensureUserInVolunteerTeam(
	ctx: MutationCtx,
	userId: Id<"users">,
): Promise<void> {
	const user = await ctx.db.get("users", userId);
	if (!user) return;

	const email = normalizeEmail(user.email);
	if (!email.endsWith("@speedcubingireland.com")) {
		return;
	}

	const teamId = await ensureVolunteerTeam(ctx);
	await addUserToTeamIfMissing(ctx, teamId, userId);
}

export async function applyPendingTeamMemberships(
	ctx: MutationCtx,
	userId: Id<"users">,
): Promise<void> {
	const user = await ctx.db.get("users", userId);
	if (!user) return;

	const email = normalizeEmail(user.email);
	if (!email) return;

	const pending = await ctx.db
		.query("pendingTeamMembers")
		.withIndex("by_email", (q) => q.eq("email", email))
		.collect();

	for (const row of pending) {
		await addUserToTeamIfMissing(ctx, row.teamId, userId);
		await ctx.db.delete("pendingTeamMembers", row._id);
	}
}

async function addUserToTeamIfMissing(
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
