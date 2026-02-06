import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { isVolunteer, requireUserId } from "./auth";

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
			await ctx.db.patch("googleSheetsTokens", existing._id, row);
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
	args: { nowSec: v.optional(v.number()) },
	returns: v.object({ connected: v.boolean() }),
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		void args.nowSec;
		const row = await ctx.db.query("googleSheetsTokens").first();
		const nowSec = Math.floor(Date.now() / 1000);
		const hasUnexpiredAccessToken =
			row != null && row.expiresAt > nowSec - TOKEN_EXPIRY_BUFFER_SEC;
		const hasRefreshToken = row != null && row.refreshToken.trim().length > 0;
		const connected = hasUnexpiredAccessToken || hasRefreshToken;
		return { connected };
	},
});

const scheduleEventShape = v.object({
	eventName: v.string(),
	rounds: v.string(),
});
const scheduleCacheShape = v.object({
	events: v.array(scheduleEventShape),
	fetchedAt: v.number(),
});

export const getScheduleFetchPreflight = internalQuery({
	args: {
		sheetId: v.string(),
		includeCache: v.boolean(),
		minFetchedAt: v.number(),
	},
	returns: v.object({
		isVolunteer: v.boolean(),
		isAllowedSheet: v.boolean(),
		cached: v.union(scheduleCacheShape, v.null()),
	}),
	handler: async (ctx, args) => {
		const volunteer = await isVolunteer(ctx);
		if (!volunteer) {
			return {
				isVolunteer: false,
				isAllowedSheet: false,
				cached: null,
			};
		}

		const competition = await ctx.db
			.query("competitions")
			.withIndex("by_comp_sheet_id", (q) =>
				q.eq("compSheet.sheetId", args.sheetId),
			)
			.first();
		if (!competition) {
			return {
				isVolunteer: true,
				isAllowedSheet: false,
				cached: null,
			};
		}
		if (args.includeCache) {
			const row = await ctx.db
				.query("sheetScheduleCache")
				.withIndex("by_sheet_id", (q) => q.eq("sheetId", args.sheetId))
				.first();
			if (row && row.fetchedAt > args.minFetchedAt) {
				return {
					isVolunteer: true,
					isAllowedSheet: true,
					cached: {
						events: row.events,
						fetchedAt: row.fetchedAt,
					},
				};
			}
		}

		return {
			isVolunteer: true,
			isAllowedSheet: true,
			cached: null,
		};
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
			await ctx.db.replace("sheetScheduleCache", existing._id, row);
		} else {
			await ctx.db.insert("sheetScheduleCache", row);
		}
		return null;
	},
});
