import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const viewEntity = v.union(v.literal("tasks"), v.literal("competitions"));

const savedViewShape = v.object({
	id: v.id("savedViews"),
	name: v.string(),
	description: v.optional(v.string()),
	entity: viewEntity,
	pageId: v.string(),
	filtersJson: v.string(),
	displaySettingsJson: v.string(),
	createdAt: v.number(),
	updatedAt: v.number(),
	lastUsedAt: v.optional(v.number()),
});

async function requireUserId(ctx: { auth: unknown }): Promise<Id<"users">> {
	const userId = await getAuthUserId(ctx as never);
	if (!userId) {
		throw new ConvexError({
			code: "UNAUTHENTICATED",
			message: "You must be signed in to manage views.",
		});
	}
	return userId as Id<"users">;
}

export const listViews = query({
	args: {
		entity: viewEntity,
		pageId: v.string(),
	},
	returns: v.array(savedViewShape),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		const docs = await ctx.db
			.query("savedViews")
			.withIndex("by_user_entity_page", (q) =>
				q
					.eq("userId", userId)
					.eq("entity", args.entity)
					.eq("pageId", args.pageId),
			)
			.order("asc")
			.collect();

		return docs.map((doc) => ({
			id: doc._id,
			name: doc.name,
			description: doc.description,
			entity: doc.entity,
			pageId: doc.pageId,
			filtersJson: doc.filtersJson,
			displaySettingsJson: doc.displaySettingsJson,
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt,
			lastUsedAt: doc.lastUsedAt,
		}));
	},
});

export const createView = mutation({
	args: {
		entity: viewEntity,
		pageId: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		filtersJson: v.string(),
		displaySettingsJson: v.string(),
	},
	returns: v.id("savedViews"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();

		const id = await ctx.db.insert("savedViews", {
			userId,
			entity: args.entity,
			pageId: args.pageId,
			name: args.name,
			description: args.description,
			filtersJson: args.filtersJson,
			displaySettingsJson: args.displaySettingsJson,
			createdAt: now,
			updatedAt: now,
			lastUsedAt: now,
		});

		return id;
	},
});

export const updateView = mutation({
	args: {
		id: v.id("savedViews"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		const doc = await ctx.db.get("savedViews", args.id);
		if (!doc) return null;
		if (doc.userId !== userId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You do not have permission to update this view.",
			});
		}

		const { id, ...updates } = args;
		await ctx.db.patch("savedViews", id, {
			...updates,
			updatedAt: Date.now(),
		});

		return null;
	},
});

export const deleteView = mutation({
	args: {
		id: v.id("savedViews"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		const doc = await ctx.db.get("savedViews", args.id);
		if (!doc) return null;
		if (doc.userId !== userId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You do not have permission to delete this view.",
			});
		}

		await ctx.db.delete("savedViews", args.id);
		return null;
	},
});

export const touchView = mutation({
	args: {
		id: v.id("savedViews"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		const doc = await ctx.db.get("savedViews", args.id);
		if (!doc) return null;
		if (doc.userId !== userId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You do not have permission to update this view.",
			});
		}

		await ctx.db.patch("savedViews", args.id, {
			lastUsedAt: Date.now(),
		});

		return null;
	},
});
