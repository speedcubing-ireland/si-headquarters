import { action } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import type { GenericActionCtx } from "convex/server";
import { ConvexError, v } from "convex/values";
import { TOKEN_VALID_BUFFER_SEC } from "./lib/constants";
import { requireVolunteerAction } from "./lib/oauth";

const WCA_BASE = "https://www.worldcubeassociation.org";
const WCA_API = `${WCA_BASE}/api/v0`;
const WCA_OAUTH_SCOPE = "public email manage_competitions";

export const getWcaOAuthUrl = action({
	args: {
		redirectUri: v.string(),
		cliToken: v.optional(v.string()),
	},
	returns: v.object({ url: v.string() }),
	handler: async (ctx, args) => {
		await requireVolunteerAction(ctx, args.cliToken);
		const clientId = process.env.AUTH_WCA_ID;
		if (!clientId) {
			throw new Error("Missing AUTH_WCA_ID env var.");
		}
		const state = crypto.randomUUID();
		const url = new URL(`${WCA_BASE}/oauth/authorize`);
		url.searchParams.set("client_id", clientId);
		url.searchParams.set("redirect_uri", args.redirectUri);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("scope", WCA_OAUTH_SCOPE);
		url.searchParams.set("state", state);
		return { url: url.toString() };
	},
});

export const exchangeCodeAndStoreTokens = action({
	args: {
		code: v.string(),
		redirectUri: v.string(),
		cliToken: v.optional(v.string()),
	},
	returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
	handler: async (ctx, args) => {
		await requireVolunteerAction(ctx, args.cliToken);
		const clientId = process.env.AUTH_WCA_ID;
		const clientSecret = process.env.AUTH_WCA_SECRET;
		if (!clientId || !clientSecret) {
			return {
				success: false,
				error: "Missing AUTH_WCA_ID or AUTH_WCA_SECRET in Convex env.",
			};
		}
		const res = await fetch(`${WCA_BASE}/oauth/token`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code: args.code,
				redirect_uri: args.redirectUri,
				client_id: clientId,
				client_secret: clientSecret,
			}),
		});

		if (!res.ok) {
			const text = await res.text();
			return { success: false, error: `Token exchange failed: ${text}` };
		}

		const tokens = (await res.json()) as {
			access_token?: string;
			refresh_token?: string;
			expires_in?: number;
			created_at?: number;
		};

		if (!tokens.access_token) {
			return { success: false, error: "WCA did not return an access_token." };
		}

		const expiresAt = tokens.created_at
			? tokens.created_at + (tokens.expires_in ?? 7200)
			: Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 7200);

		await ctx.runMutation(internal.wcaQueries.setWcaTokens, {
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token ?? "",
			expiresAt,
		});

		return { success: true };
	},
});

async function getValidAccessToken(
	ctx: GenericActionCtx<DataModel>,
): Promise<string | null> {
	const token = (await ctx.runQuery(internal.wcaQueries.getWcaToken, {})) as {
		accessToken: string;
		refreshToken: string;
		expiresAt: number;
	} | null;
	if (!token) return null;
	const nowSec = Math.floor(Date.now() / 1000);
	if (token.expiresAt > nowSec + TOKEN_VALID_BUFFER_SEC)
		return token.accessToken;

	if (!token.refreshToken) return token.accessToken;

	const clientId = process.env.AUTH_WCA_ID;
	const clientSecret = process.env.AUTH_WCA_SECRET;
	if (!clientId || !clientSecret) return token.accessToken;

	const res = await fetch(`${WCA_BASE}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: token.refreshToken,
			client_id: clientId,
			client_secret: clientSecret,
		}),
	});

	if (!res.ok) return token.accessToken;

	const newTokens = (await res.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
		created_at?: number;
	};

	if (!newTokens.access_token) return token.accessToken;

	const expiresAt = newTokens.created_at
		? newTokens.created_at + (newTokens.expires_in ?? 7200)
		: Math.floor(Date.now() / 1000) + (newTokens.expires_in ?? 7200);

	await ctx.runMutation(internal.wcaQueries.setWcaTokens, {
		accessToken: newTokens.access_token,
		refreshToken: newTokens.refresh_token ?? token.refreshToken,
		expiresAt,
	});

	return newTokens.access_token;
}

async function wcaFetch(accessToken: string, path: string): Promise<unknown> {
	const res = await fetch(`${WCA_API}${path}`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) {
		throw new Error(`WCA API ${path} failed: ${res.status} ${res.statusText}`);
	}
	return res.json();
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

		const accessToken = await getValidAccessToken(ctx);
		if (!accessToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message:
					"No WCA token. Run bun run auth:wca from repo root to connect.",
			});
		}

		const params = new URLSearchParams({ q: args.query });
		if (args.managedByMe) params.set("managed_by_me", "true");
		const data = (await wcaFetch(
			accessToken,
			`/competitions?${params}`,
		)) as Array<{
			id: string;
			name: string;
			city: string;
			country_iso2: string;
			start_date: string;
			end_date: string;
			event_ids: string[];
		}>;
		return (Array.isArray(data) ? data : []).slice(0, 10).map((c) => ({
			id: c.id,
			name: c.name,
			city: c.city ?? "",
			country_iso2: c.country_iso2 ?? "",
			start_date: c.start_date ?? "",
			end_date: c.end_date ?? "",
			event_ids: c.event_ids ?? [],
		}));
	},
});

export const fetchMyCompetitions = action({
	args: {},
	returns: v.array(wcaCompetitionResult),
	handler: async (ctx) => {
		await requireVolunteerAction(ctx);

		const accessToken = await getValidAccessToken(ctx);
		if (!accessToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message:
					"No WCA token. Run bun run auth:wca from repo root to connect.",
			});
		}

		const params = new URLSearchParams({
			managed_by_me: "true",
			sort: "-start_date",
		});
		const data = (await wcaFetch(
			accessToken,
			`/competitions?${params}`,
		)) as Array<{
			id: string;
			name: string;
			city: string;
			country_iso2: string;
			start_date: string;
			end_date: string;
			event_ids: string[];
		}>;
		return (Array.isArray(data) ? data : []).slice(0, 20).map((c) => ({
			id: c.id,
			name: c.name,
			city: c.city ?? "",
			country_iso2: c.country_iso2 ?? "",
			start_date: c.start_date ?? "",
			end_date: c.end_date ?? "",
			event_ids: c.event_ids ?? [],
		}));
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
		const accessToken = await getValidAccessToken(ctx);
		if (!accessToken) return null;

		const res = await fetch(
			`${WCA_API}/competitions/${encodeURIComponent(args.wcaCompetitionId)}`,
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
				typeof data.competitor_limit === "number"
					? data.competitor_limit
					: null,
			venue: String(data.venue ?? ""),
			url: `${WCA_BASE}/competitions/${encodeURIComponent(String(data.id ?? args.wcaCompetitionId))}`,
		};
	},
});
