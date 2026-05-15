import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUserId } from "./auth";

const phaseDoc = v.object({
	_id: v.id("phases"),
	_creationTime: v.number(),
	key: v.string(),
	name: v.string(),
	description: v.string(),
	order: v.number(),
	archived: v.boolean(),
});

export const list = query({
	args: {},
	returns: v.array(phaseDoc),
	handler: async (ctx) => {
		await requireUserId(ctx);
		return await ctx.db
			.query("phases")
			.withIndex("by_order")
			.order("asc")
			.collect();
	},
});
