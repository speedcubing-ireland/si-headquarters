"use node";

import { action } from "../../_generated/server";
import type { DataModel } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import type { GenericActionCtx } from "convex/server";
import { ConvexError, v } from "convex/values";
import { SCHEDULE_CACHE_TTL_MS } from "../../lib/constants";
import { requireVolunteerAction } from "../../lib/oauth";
import { fetchGoogleSheetValues } from "./client/sheetsClient";
import { getServiceAccessToken } from "../tokens/runtime";

const RANGE = "Schedule!A6:B22";

type ScheduleEvent = { eventName: string; rounds: string };
type ScheduleFetchPreflight = {
	isVolunteer: boolean;
	isAllowedSheet: boolean;
	cached: {
		events: ScheduleEvent[];
		fetchedAt: number;
	} | null;
};

async function getScheduleFetchPreflight(
	ctx: GenericActionCtx<DataModel>,
	args: {
		sheetId: string;
		includeCache: boolean;
		minFetchedAt: number;
	},
): Promise<ScheduleFetchPreflight> {
	return await ctx.runQuery(
		internal.integrations.google.sheetsQueries.getScheduleFetchPreflight,
		args,
	);
}

async function getGoogleAccessToken(
	ctx: GenericActionCtx<DataModel>,
): Promise<string | null> {
	return await getServiceAccessToken(ctx, "google");
}

export const fetchScheduleEvents = action({
	args: {
		sheetId: v.string(),
		skipCache: v.optional(v.boolean()),
	},
	returns: v.union(
		v.object({
			events: v.array(
				v.object({
					eventName: v.string(),
					rounds: v.string(),
				}),
			),
			fetchedAt: v.number(),
		}),
		v.object({ error: v.string() }),
	),
	handler: async (ctx, args) => {
		await requireVolunteerAction(ctx);
		const now = Date.now();
		const preflight = await getScheduleFetchPreflight(ctx, {
			sheetId: args.sheetId,
			includeCache: !args.skipCache,
			minFetchedAt: now - SCHEDULE_CACHE_TTL_MS,
		});
		if (!preflight.isVolunteer) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Volunteer access required",
			});
		}
		if (!preflight.isAllowedSheet) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Sheet is not linked to a competition",
			});
		}
		if (preflight.cached) {
			return {
				events: preflight.cached.events,
				fetchedAt: preflight.cached.fetchedAt,
			};
		}

		const accessToken = await getGoogleAccessToken(ctx);
		if (!accessToken) {
			return {
				error:
					"No Google Sheets token. Run bun run auth google-sheets from repo root.",
			};
		}

		try {
			const rows = await fetchGoogleSheetValues({
				accessToken,
				spreadsheetId: args.sheetId,
				range: RANGE,
			});
			const events: ScheduleEvent[] = rows.map((row) => ({
				eventName: row[0] ?? "",
				rounds: row[1] ?? "",
			}));
			await ctx.runMutation(
				internal.integrations.google.sheetsQueries.setCachedSchedule,
				{
					sheetId: args.sheetId,
					events,
					fetchedAt: now,
				},
			);
			return { events, fetchedAt: now };
		} catch (err) {
			return {
				error: err instanceof Error ? err.message : "Sheet unavailable",
			};
		}
	},
});
