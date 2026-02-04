import Google from "@auth/core/providers/google";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
	providers: [Google],
});

const VOLUNTEER_TEAM_NAME = "Volunteer";

type AuthCtx = QueryCtx | MutationCtx;

/**
 * Require that the caller is authenticated and return their user id.
 * Throws a ConvexError if no authenticated user is present.
 */
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

/**
 * Check if the current user is a volunteer (member of the Volunteer team).
 */
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

/**
 * Ensure the Volunteer team exists, creating it if missing.
 * Returns the team ID.
 * Note: This requires MutationCtx because it may need to insert.
 */
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

/**
 * Add a user to the Volunteer team if they have a @speedcubingireland.com email.
 * Idempotent - safe to call multiple times.
 */
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

	if (team.memberIds.includes(userId)) {
		return; // Already a member
	}

	await ctx.db.patch("teams", teamId, {
		memberIds: [...team.memberIds, userId],
	});
}
