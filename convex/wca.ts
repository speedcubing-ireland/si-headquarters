import { action, internalAction } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import type { GenericActionCtx } from "convex/server";
import { ConvexError, v } from "convex/values";
import { requireVolunteerAction } from "./lib/oauth";
import {
	WCA_BASE,
	SEARCH_RESULTS_LIMIT,
	MY_COMPETITIONS_LIMIT,
	mapCompetitionResult,
	type WcaCompetition,
	wcaFetch,
} from "./services/wca";
import { getServiceAccessToken } from "./services/tokens/runtime";

async function getWcaAccessToken(
	ctx: GenericActionCtx<DataModel>,
): Promise<string | null> {
	return await getServiceAccessToken(ctx, "wca");
}

const wcaCompetitionResult = v.object({
	id: v.string(),
	name: v.string(),
	city: v.string(),
	country_iso2: v.string(),
	start_date: v.string(),
	end_date: v.string(),
	event_ids: v.array(v.string()),
});

export const searchCompetitions = action({
	args: { query: v.string(), managedByMe: v.optional(v.boolean()) },
	returns: v.array(wcaCompetitionResult),
	handler: async (ctx, args) => {
		await requireVolunteerAction(ctx);
		if (!args.query.trim()) return [];

		const accessToken = await getWcaAccessToken(ctx);
		if (!accessToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message:
					"No WCA token. Run bun run auth wca from repo root to connect.",
			});
		}

		const params = new URLSearchParams({ q: args.query });
		if (args.managedByMe) params.set("managed_by_me", "true");
		const data = (await wcaFetch(
			accessToken,
			`/competitions?${params}`,
		)) as WcaCompetition[];
		return (Array.isArray(data) ? data : [])
			.slice(0, SEARCH_RESULTS_LIMIT)
			.map(mapCompetitionResult);
	},
});

export const fetchMyCompetitions = action({
	args: {},
	returns: v.array(wcaCompetitionResult),
	handler: async (ctx) => {
		await requireVolunteerAction(ctx);

		const accessToken = await getWcaAccessToken(ctx);
		if (!accessToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message:
					"No WCA token. Run bun run auth wca from repo root to connect.",
			});
		}

		const params = new URLSearchParams({
			managed_by_me: "true",
			sort: "-start_date",
		});
		const data = (await wcaFetch(
			accessToken,
			`/competitions?${params}`,
		)) as WcaCompetition[];
		return (Array.isArray(data) ? data : [])
			.slice(0, MY_COMPETITIONS_LIMIT)
			.map(mapCompetitionResult);
	},
});

const wcaCompetitionDetails = v.object({
	id: v.string(),
	name: v.string(),
	city: v.string(),
	country_iso2: v.string(),
	start_date: v.string(),
	end_date: v.string(),
	event_ids: v.array(v.string()),
	competitor_limit: v.union(v.number(), v.null()),
	venue: v.string(),
	url: v.string(),
});

export const fetchCompetitionDetails = action({
	args: { wcaCompetitionId: v.string() },
	returns: v.union(wcaCompetitionDetails, v.null()),
	handler: async (ctx, args) => {
		await requireVolunteerAction(ctx);
		return await fetchCompetitionDetailsWithStoredToken(
			ctx,
			args.wcaCompetitionId,
		);
	},
});

export const fetchCompetitionDetailsInternal = internalAction({
	args: { wcaCompetitionId: v.string() },
	returns: v.union(wcaCompetitionDetails, v.null()),
	handler: async (ctx, args) => {
		return await fetchCompetitionDetailsWithStoredToken(
			ctx,
			args.wcaCompetitionId,
		);
	},
});

async function fetchCompetitionDetailsWithStoredToken(
	ctx: GenericActionCtx<DataModel>,
	wcaCompetitionId: string,
) {
	const accessToken = await getWcaAccessToken(ctx);
	if (!accessToken) return null;

	const res = await fetch(
		`${WCA_BASE}/api/v0/competitions/${encodeURIComponent(wcaCompetitionId)}`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);

	if (!res.ok) return null;

	const data = (await res.json()) as Record<string, unknown>;

	return {
		id: String(data.id ?? ""),
		name: String(data.name ?? ""),
		city: String(data.city ?? ""),
		country_iso2: String(data.country_iso2 ?? ""),
		start_date: String(data.start_date ?? ""),
		end_date: String(data.end_date ?? ""),
		event_ids: Array.isArray(data.event_ids)
			? (data.event_ids as string[])
			: [],
		competitor_limit:
			typeof data.competitor_limit === "number" ? data.competitor_limit : null,
		venue: String(data.venue ?? ""),
		url: `${WCA_BASE}/competitions/${encodeURIComponent(String(data.id ?? wcaCompetitionId))}`,
	};
}
