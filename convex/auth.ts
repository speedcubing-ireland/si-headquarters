import Google from "@auth/core/providers/google";
import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";

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
});

const VOLUNTEER_TEAM_NAME = "Volunteer";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireUserId(
	ctx: QueryCtx | MutationCtx,
): Promise<
	ReturnType<typeof getAuthUserId> extends Promise<infer T> ? T : never
> {
	const userId = await getAuthUserId(ctx);
	if (userId === null) {
		throw new ConvexError("Authentication required");
	}
	return userId as never;
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

	const email = user.email?.toLowerCase() ?? "";
	if (!email.endsWith("@speedcubingireland.com")) {
		return;
	}

	const teamId = await ensureVolunteerTeam(ctx);
	const team = await ctx.db.get("teams", teamId);
	if (!team) return;

	if (team.memberIds.includes(userId)) return;

	await ctx.db.patch("teams", teamId, {
		memberIds: [...team.memberIds, userId],
	});
}
