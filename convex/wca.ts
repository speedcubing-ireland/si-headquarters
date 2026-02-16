import { action, internalAction } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import type { GenericActionCtx } from "convex/server";
import { ConvexError, v } from "convex/values";
import { requireVolunteerAction } from "./lib/oauth";
import {
	WCA_BASE,
	SEARCH_RESULTS_LIMIT,
	MY_COMPETITIONS_LIMIT,
} from "./services/wca";
import { createClient, createConfig } from "./services/wca/client/client/index";
import {
	competitionById,
	competitionList2,
	getMyCompetitions,
} from "./services/wca/client/sdk.gen";
import { getServiceAccessToken } from "./services/tokens/runtime";

type WcaCompetition = {
	id: string;
	name: string;
	city: string;
	country_iso2: string;
	start_date: string;
	end_date: string;
	event_ids: string[];
};

function mapCompetition(c: {
	id?: string;
	name?: string;
	city?: string;
	country_iso2?: string;
	start_date?: string;
	end_date?: string;
	event_ids?: string[];
}): WcaCompetition {
	return {
		id: c.id ?? "",
		name: c.name ?? "",
		city: c.city ?? "",
		country_iso2: c.country_iso2 ?? "",
		start_date: c.start_date ?? "",
		end_date: c.end_date ?? "",
		event_ids: c.event_ids ?? [],
	};
}

async function getWcaAccessToken(
	ctx: GenericActionCtx<DataModel>,
): Promise<string | null> {
	return await getServiceAccessToken(ctx, "wca");
}

function createWcaClient(accessToken: string) {
	return createClient(
		createConfig({
			baseUrl: "https://www.worldcubeassociation.org/api",
			headers: new Headers({
				Authorization: `Bearer ${accessToken}`,
			}),
		}),
	);
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

		const client = createWcaClient(accessToken);
		const r = await competitionList2({
			client,
			query: {
				q: args.query,
				...(args.managedByMe && { sort: "-start_date" }),
			},
		});
		if (r.error) throw new Error(`WCA search failed: ${r.error}`);
		const list = Array.isArray(r.data) ? r.data : [];
		return list.slice(0, SEARCH_RESULTS_LIMIT).map(mapCompetition);
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

		const client = createWcaClient(accessToken);
		const r = await getMyCompetitions({ client });
		if (r.error) throw new Error(`WCA my competitions failed: ${r.error}`);
		const data = r.data;
		if (!data) throw new Error("WCA my competitions: no data");
		const all = [
			...(data.past_competitions ?? []),
			...(data.future_competitions ?? []),
			...(data.bookmarked_competitions ?? []),
		].map((c) =>
			mapCompetition({
				id: c.id,
				name: c.name,
				city: c.city,
				country_iso2: c.country_iso2,
				start_date: c.start_date,
				end_date: c.end_date,
				event_ids: [],
			}),
		);
		return all.slice(0, MY_COMPETITIONS_LIMIT);
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

	const client = createWcaClient(accessToken);
	const r = await competitionById({
		client,
		path: { competitionId: wcaCompetitionId },
	});
	if (r.error || !r.data) return null;
	const data = r.data;

	return {
		id: data.id ?? "",
		name: data.name ?? "",
		city: data.city ?? "",
		country_iso2: data.country_iso2 ?? "",
		start_date: data.start_date ?? "",
		end_date: data.end_date ?? "",
		event_ids: Array.isArray(data.event_ids) ? data.event_ids : [],
		competitor_limit:
			typeof data.competitor_limit === "number" ? data.competitor_limit : null,
		venue: data.venue ?? "",
		url: `${WCA_BASE}/competitions/${encodeURIComponent(data.id ?? wcaCompetitionId)}`,
	};
}
