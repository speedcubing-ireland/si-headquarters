import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId, ensureUserInVolunteerTeam } from "./auth";

const userDocValidator = v.union(
	v.null(),
	v.object({
		_id: v.id("users"),
		_creationTime: v.number(),
		name: v.optional(v.string()),
		image: v.optional(v.string()),
		email: v.optional(v.string()),
	}),
);

export const appUserShape = v.object({
	id: v.id("users"),
	name: v.string(),
	avatarUrl: v.string(),
});

export const getCurrentUser = query({
	args: {},
	returns: userDocValidator,
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) return null;
		const user = await ctx.db.get("users", userId);
		if (!user) return null;
		return {
			_id: user._id,
			_creationTime: user._creationTime,
			name: user.name,
			image: user.image,
			email: user.email,
		};
	},
});

export const listUsers = query({
	args: {},
	returns: v.array(appUserShape),
	handler: async (ctx) => {
		await requireUserId(ctx);
		const users = await ctx.db.query("users").collect();
		return users.map((u) => ({
			id: u._id,
			name: u.name ?? "",
			avatarUrl: u.image ?? "",
		}));
	},
});

/**
 * Ensure the current user is added to the Volunteer team if they have
 * a @speedcubingireland.com email. Idempotent - safe to call multiple times.
 * This should be called on app initialization to auto-enroll users.
 */
export const ensureVolunteerAccess = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		await ensureUserInVolunteerTeam(ctx, userId);
		return null;
	},
});
