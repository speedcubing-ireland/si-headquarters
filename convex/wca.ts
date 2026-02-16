import { action, internalAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { GenericActionCtx } from "convex/server";
import { ConvexError, v } from "convex/values";
import { requireVolunteerAction } from "./lib/oauth";
import { WCA_BASE, SEARCH_RESULTS_LIMIT } from "./services/wca";
import { createWcaClient } from "./services/wca/client";
import {
	competitionById,
	competitionList2,
	getMyCompetitions,
} from "./services/wca/client/sdk.gen";
import { getServiceAccessToken } from "./services/tokens/runtime";

const SPONSOR_PATTERNS = [
	{ pattern: /\bkewbz\b/i, label: "Kewbz" },
	{ pattern: /\bu[\s-]*twist[\s-]*cubes?\b/i, label: "UTwistCubes" },
] as const;

function detectSponsorLabels(text: string): string[] {
	return SPONSOR_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
		({ label }) => label,
	);
}

function uniqueCompetitionIds(competitions: Array<{ id?: string }>): string[] {
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const competition of competitions) {
		const id = competition.id;
		if (!id || seen.has(id)) continue;
		seen.add(id);
		ids.push(id);
	}
	return ids;
}

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

function wcaCompetitionUrl(competitionId: string): string {
	return `${WCA_BASE}/competitions/${encodeURIComponent(competitionId)}`;
}

type MyCompetitionsData = NonNullable<
	Awaited<ReturnType<typeof getMyCompetitions>>["data"]
>;

async function getWcaClientAndMyCompetitionsData(
	ctx: GenericActionCtx<DataModel>,
): Promise<{
	client: ReturnType<typeof createWcaClient>;
	data: MyCompetitionsData;
}> {
	const accessToken = await getWcaAccessToken(ctx);
	if (!accessToken) {
		throw new ConvexError({
			code: "PRECONDITION_FAILED",
			message: "No WCA token. Run bun run auth wca from repo root to connect.",
		});
	}
	const client = createWcaClient(accessToken);
	const r = await getMyCompetitions({ client });
	if (r.error) throw new Error(`WCA my competitions failed: ${r.error}`);
	const data = r.data;
	if (!data) throw new Error("WCA my competitions: no data");
	return { client, data };
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
		const { data } = await getWcaClientAndMyCompetitionsData(ctx);
		const ordered = [
			...(data.future_competitions ?? []),
			...(data.past_competitions ?? []),
			...(data.bookmarked_competitions ?? []),
		];
		const seen = new Set<string>();
		const all: WcaCompetition[] = [];
		for (const c of ordered) {
			const id = c.id;
			if (!id || seen.has(id)) continue;
			seen.add(id);
			all.push(
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
		}
		return all;
	},
});

const socialDashboardCompetitionShape = v.object({
	id: v.string(),
	name: v.string(),
	start_date: v.string(),
	end_date: v.string(),
	event_ids: v.array(v.string()),
	competitor_limit: v.union(v.number(), v.null()),
	registration_open: v.union(v.string(), v.null()),
	sponsor_labels: v.array(v.string()),
	url: v.string(),
});

type SocialDashboardCompetition = {
	id: string;
	name: string;
	start_date: string;
	end_date: string;
	event_ids: string[];
	competitor_limit: number | null;
	registration_open: string | null;
	sponsor_labels: string[];
	url: string;
};

export const fetchSocialMediaDashboardCompetitions = action({
	args: {},
	returns: v.array(socialDashboardCompetitionShape),
	handler: async (ctx) => {
		const canAccess = await ctx.runQuery(
			api.admin.canAccessSocialMediaDashboard,
			{},
		);
		if (!canAccess) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Directors or Social Media Team only.",
			});
		}

		const { client, data } = await getWcaClientAndMyCompetitionsData(ctx);
		const allIds = uniqueCompetitionIds([...(data.future_competitions ?? [])]);

		const detailResults = await Promise.all(
			allIds.map(async (id): Promise<SocialDashboardCompetition | null> => {
				const dr = await competitionById({
					client,
					path: { competitionId: id },
				});
				if (dr.error || !dr.data) return null;

				const d = dr.data;
				const text = [
					d.name,
					d.information,
					d.venue,
					d.extra_registration_requirements,
				]
					.filter(Boolean)
					.join(" ");
				const sponsor_labels = detectSponsorLabels(text);

				return {
					id: d.id ?? id,
					name: d.name ?? "",
					start_date: d.start_date ?? "",
					end_date: d.end_date ?? "",
					event_ids: Array.isArray(d.event_ids) ? d.event_ids : [],
					competitor_limit:
						typeof d.competitor_limit === "number" ? d.competitor_limit : null,
					registration_open: d.registration_open ?? null,
					sponsor_labels,
					url: wcaCompetitionUrl(d.id ?? id),
				};
			}),
		);

		return detailResults.filter(
			(competition): competition is SocialDashboardCompetition =>
				competition !== null,
		);
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
		url: wcaCompetitionUrl(data.id ?? wcaCompetitionId),
	};
}
