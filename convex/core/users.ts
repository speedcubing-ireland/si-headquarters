import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
	requireUserId,
	ensureUserInVolunteerTeam,
	applyPendingTeamMemberships,
} from "./auth";
import { resolveUserAvatarUrl } from "../lib/avatarResolver";

const userDocValidator = v.union(
	v.null(),
	v.object({
		_id: v.id("users"),
		_creationTime: v.number(),
		name: v.optional(v.string()),
		email: v.optional(v.string()),
		avatarUrl: v.string(),
	}),
);

const MAX_NAME_LENGTH = 80;

function sanitizeName(name: string): string {
	const nextName = name.trim();
	if (!nextName) {
		throw new ConvexError("Name cannot be empty.");
	}
	if (nextName.length > MAX_NAME_LENGTH) {
		throw new ConvexError("Name is too long.");
	}
	return nextName;
}

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
			email: user.email,
			avatarUrl: resolveUserAvatarUrl(user),
		};
	},
});

export const listUsers = query({
	args: {},
	returns: v.array(appUserShape),
	handler: async (ctx) => {
		await requireUserId(ctx);
		const users = await ctx.db.query("users").withIndex("email").collect();
		return users.map((u) => ({
			id: u._id,
			name: u.name ?? "",
			avatarUrl: resolveUserAvatarUrl(u),
		}));
	},
});

export const ensureVolunteerAccess = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		await ensureUserInVolunteerTeam(ctx, userId);
		await applyPendingTeamMemberships(ctx, userId);
		return null;
	},
});

export const updateCurrentUserName = mutation({
	args: {
		name: v.string(),
	},
	returns: v.string(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const nextName = sanitizeName(args.name);
		await ctx.db.patch("users", userId, { name: nextName });
		return nextName;
	},
});
