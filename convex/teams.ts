import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./auth";

const teamDoc = v.object({
	_id: v.id("teams"),
	_creationTime: v.number(),
	name: v.string(),
	memberIds: v.array(v.id("users")),
});

export const list = query({
	args: {},
	returns: v.array(teamDoc),
	handler: async (ctx) => {
		// Teams are only visible to authenticated users.
		await requireUserId(ctx);
		return await ctx.db
			.query("teams")
			.withIndex("by_name")
			.order("asc")
			.collect();
	},
});

export const get = query({
	args: { teamId: v.id("teams") },
	returns: v.union(teamDoc, v.null()),
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		return await ctx.db.get("teams", args.teamId);
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		memberIds: v.optional(v.array(v.id("users"))),
	},
	returns: v.id("teams"),
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		return await ctx.db.insert("teams", {
			name: args.name,
			memberIds: args.memberIds ?? [],
		});
	},
});

export const update = mutation({
	args: {
		teamId: v.id("teams"),
		name: v.optional(v.string()),
		memberIds: v.optional(v.array(v.id("users"))),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		const { teamId, ...updates } = args;
		const doc = await ctx.db.get("teams", teamId);
		if (!doc) return null;
		await ctx.db.patch("teams", teamId, updates);
		return null;
	},
});
