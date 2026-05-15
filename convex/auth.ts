import Google from "@auth/core/providers/google";
import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
	internalQuery,
	query,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { TEAM_NAMES } from "./lib/constants";
import { buildDefaultAvatarUrl } from "./lib/defaultAvatar";
import { requireAuthenticatedUserId } from "./lib/permissions/authn";
import { isVolunteerForCtx } from "./lib/permissions/policies";
import { normalizeEmail } from "./lib/sanitize";
import { z } from "zod";
import { v } from "convex/values";
import { WCA_BASE_URL } from "./integrations/wca";

function hasAvatarImage(image: string | null | undefined): boolean {
	return typeof image === "string" && image.trim().length > 0;
}

const wcaMeSchema = z.object({
	id: z.number(),
	name: z.string(),
	email: z.string(),
	avatar: z.optional(
		z.object({
			url: z.optional(z.string()),
			thumb_url: z.optional(z.string()),
		}),
	),
});

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
			url: `${WCA_BASE_URL}/oauth/authorize`,
			params: {
				scope: "public email",
			},
		},
		token: `${WCA_BASE_URL}/oauth/token`,
		userinfo: `${WCA_BASE_URL}/api/v0/me`,
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		profile(profile) {
			const me = wcaMeSchema.parse(profile);
			return {
				id: String(me.id),
				name: me.name,
				email: me.email,
				image: me.avatar?.url ?? me.avatar?.thumb_url,
			};
		},
	};
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
	providers: [
		ConvexCredentials({
			id: "god-mode-ticket",
			authorize: async (credentials, ctx) => {
				const ticket =
					typeof credentials.ticket === "string"
						? credentials.ticket.trim()
						: "";
				const consumptionNonce =
					typeof credentials.consumptionNonce === "string"
						? credentials.consumptionNonce.trim()
						: "";
				if (!ticket) {
					return null;
				}
				if (!consumptionNonce) {
					return null;
				}
				try {
					return await ctx.runMutation(
						internal.admin.consumeUserImpersonationTicket,
						{ ticket, consumptionNonce },
					);
				} catch {
					return null;
				}
			},
		}),
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

			const user = await ctx.db.get("users", args.userId);
			if (!user || hasAvatarImage(user.image)) {
				return;
			}

			await ctx.db.patch("users", args.userId, {
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
	return requireAuthenticatedUserId(ctx);
}

export async function isVolunteer(ctx: AuthCtx): Promise<boolean> {
	return isVolunteerForCtx(ctx);
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
