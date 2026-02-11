import type { DataModel } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { GenericActionCtx } from "convex/server";
import { TOKEN_VALID_BUFFER_SEC } from "../lib/constants";
import { requireVolunteerAction } from "../lib/oauth";

export { requireVolunteerAction };

export const WCA_BASE = "https://www.worldcubeassociation.org";
export const WCA_API = `${WCA_BASE}/api/v0`;
export const WCA_OAUTH_SCOPE = "public email manage_competitions";

export const SEARCH_RESULTS_LIMIT = 10;
export const MY_COMPETITIONS_LIMIT = 20;

export async function getValidAccessToken(
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

export async function wcaFetch(
	accessToken: string,
	path: string,
): Promise<unknown> {
	const res = await fetch(`${WCA_API}${path}`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) {
		throw new Error(`WCA API ${path} failed: ${res.status} ${res.statusText}`);
	}
	return res.json();
}

export function mapCompetitionResult(c: {
	id: string;
	name: string;
	city: string;
	country_iso2: string;
	start_date: string;
	end_date: string;
	event_ids: string[];
}) {
	return {
		id: c.id,
		name: c.name,
		city: c.city ?? "",
		country_iso2: c.country_iso2 ?? "",
		start_date: c.start_date ?? "",
		end_date: c.end_date ?? "",
		event_ids: c.event_ids ?? [],
	};
}
