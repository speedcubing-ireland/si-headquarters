import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId } from "./auth";

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

const appUserShape = v.object({
	id: v.string(),
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
		// Only authenticated callers can list users.
		await requireUserId(ctx);
		const users = await ctx.db.query("users").collect();
		return users.map((u) => ({
			id: u._id,
			name: u.name ?? "",
			avatarUrl: u.image ?? "",
		}));
	},
});
