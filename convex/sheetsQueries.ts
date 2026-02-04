import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

const TOKEN_EXPIRY_BUFFER_SEC = 5 * 60;

export const setGoogleSheetsTokens = internalMutation({
	args: {
		accessToken: v.string(),
		refreshToken: v.string(),
		expiresAt: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now();
		const existing = await ctx.db.query("googleSheetsTokens").first();
		const row = {
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			expiresAt: args.expiresAt,
			updatedAt: now,
		};
		if (existing) {
			await ctx.db.patch(existing._id, row);
		} else {
			await ctx.db.insert("googleSheetsTokens", row);
		}
		return null;
	},
});

export const getGoogleSheetsToken = internalQuery({
	args: {},
	returns: v.union(
		v.object({
			accessToken: v.string(),
			refreshToken: v.string(),
			expiresAt: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx) => {
		const row = await ctx.db.query("googleSheetsTokens").first();
		if (!row) return null;
		return {
			accessToken: row.accessToken,
			refreshToken: row.refreshToken,
			expiresAt: row.expiresAt,
		};
	},
});

export const getGoogleSheetsConnectionStatus = query({
	args: {},
	returns: v.object({ connected: v.boolean() }),
	handler: async (ctx) => {
		const row = await ctx.db.query("googleSheetsTokens").first();
		const nowSec = Math.floor(Date.now() / 1000);
		const connected =
			row != null && row.expiresAt > nowSec - TOKEN_EXPIRY_BUFFER_SEC;
		return { connected };
	},
});

const scheduleEventShape = v.object({
	eventName: v.string(),
	rounds: v.string(),
});

export const getIsCompetitionSheetId = internalQuery({
	args: { sheetId: v.string() },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const comps = await ctx.db.query("competitions").collect();
		return comps.some(
			(c) =>
				c.compSheet?.type === "google-sheet" &&
				c.compSheet.sheetId === args.sheetId,
		);
	},
});

export const getCachedSchedule = internalQuery({
	args: { sheetId: v.string() },
	returns: v.union(
		v.object({
			events: v.array(scheduleEventShape),
			fetchedAt: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const row = await ctx.db
			.query("sheetScheduleCache")
			.withIndex("by_sheet_id", (q) => q.eq("sheetId", args.sheetId))
			.first();
		if (!row) return null;
		return { events: row.events, fetchedAt: row.fetchedAt };
	},
});

export const setCachedSchedule = internalMutation({
	args: {
		sheetId: v.string(),
		events: v.array(scheduleEventShape),
		fetchedAt: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("sheetScheduleCache")
			.withIndex("by_sheet_id", (q) => q.eq("sheetId", args.sheetId))
			.first();
		if (existing && args.fetchedAt <= existing.fetchedAt) {
			return null;
		}
		const row = {
			sheetId: args.sheetId,
			events: args.events,
			fetchedAt: args.fetchedAt,
		};
		if (existing) {
			await ctx.db.replace(existing._id, row);
		} else {
			await ctx.db.insert("sheetScheduleCache", row);
		}
		return null;
	},
});
