import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getUserThemeSettings = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			themeJson: v.string(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) return null;

		const settings = await ctx.db
			.query("userThemeSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();

		if (!settings) return null;

		return {
			themeJson: settings.themeJson,
			updatedAt: settings.updatedAt,
		};
	},
});

export const upsertUserThemeSettings = mutation({
	args: {
		themeJson: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) {
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Not authenticated",
			});
		}

		const existing = await ctx.db
			.query("userThemeSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();

		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				themeJson: args.themeJson,
				updatedAt: now,
			});
		} else {
			await ctx.db.insert("userThemeSettings", {
				userId,
				themeJson: args.themeJson,
				updatedAt: now,
			});
		}

		return null;
	},
});

export const deleteUserThemeSettings = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) {
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Not authenticated",
			});
		}

		const existing = await ctx.db
			.query("userThemeSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();

		if (existing) {
			await ctx.db.delete(existing._id);
		}

		return null;
	},
});
