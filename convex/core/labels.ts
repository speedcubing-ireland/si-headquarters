import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUserId } from "./auth";
import { requireDirector } from "./admin";

const labelDoc = v.object({
	_id: v.id("labels"),
	_creationTime: v.number(),
	name: v.string(),
	color: v.string(),
	archived: v.boolean(),
});

export const list = query({
	args: {},
	returns: v.array(labelDoc),
	handler: async (ctx) => {
		await requireUserId(ctx);
		return await ctx.db
			.query("labels")
			.withIndex("by_name")
			.order("asc")
			.collect();
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		color: v.string(),
	},
	returns: v.id("labels"),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		return await ctx.db.insert("labels", {
			name: args.name,
			color: args.color,
			archived: false,
		});
	},
});

export const update = mutation({
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

export const remove = mutation({
	args: { id: v.id("labels") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		await ctx.db.delete("labels", args.id);
		return null;
	},
});
