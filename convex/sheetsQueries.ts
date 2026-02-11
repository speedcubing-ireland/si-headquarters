import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { isVolunteer } from "./auth";
import { createTokenMutations } from "./lib/oauthTokens";

const tokens = createTokenMutations("googleSheetsTokens");

export const {
	setTokens: setGoogleSheetsTokens,
	getToken: getGoogleSheetsToken,
	getConnectionStatus: getGoogleSheetsConnectionStatus,
} = tokens;

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
