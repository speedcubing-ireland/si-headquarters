"use node";

import { action } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import type { GenericActionCtx } from "convex/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";
import { google } from "googleapis";
import { SCHEDULE_CACHE_TTL_MS, TOKEN_VALID_BUFFER_SEC } from "./lib/constants";

async function requireVolunteerAction(
	ctx: GenericActionCtx<DataModel>,
	cliToken?: string,
): Promise<void> {
	// Allow CLI access with a secret token
	if (cliToken) {
		const expectedToken = process.env.CLI_AUTH_TOKEN;
		if (expectedToken && cliToken === expectedToken) {
			return; // CLI authentication successful
		}
		throw new ConvexError({
			code: "UNAUTHENTICATED",
			message: "Invalid CLI token",
		});
	}
	// Otherwise require volunteer authentication
	const isVol = await ctx.runQuery(internal.auth.getIsVolunteer, {});
	if (!isVol)
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Volunteer access required",
		});
}

const RANGE = "Schedule!A6:B22";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

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
		internal.sheetsQueries.getScheduleFetchPreflight,
		args,
	);
}

export const getGoogleOAuthUrl = action({
	args: {
		redirectUri: v.string(),
		cliToken: v.optional(v.string()),
	},
	returns: v.object({ url: v.string() }),
	handler: async (ctx, args) => {
		await requireVolunteerAction(ctx, args.cliToken);
		const clientId = process.env.AUTH_GOOGLE_ID;
		if (!clientId) {
			throw new Error(
				"Missing AUTH_GOOGLE_ID. Set it in Convex dashboard (same as Google sign-in).",
			);
		}
		const state = crypto.randomUUID();
		const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
		url.searchParams.set("client_id", clientId);
		url.searchParams.set("redirect_uri", args.redirectUri);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("scope", SHEETS_SCOPE);
		url.searchParams.set("access_type", "offline");
		url.searchParams.set("prompt", "consent");
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
		const clientId = process.env.AUTH_GOOGLE_ID;
		const clientSecret = process.env.AUTH_GOOGLE_SECRET;
		if (!clientId || !clientSecret) {
			return {
				success: false,
				error: "Missing AUTH_GOOGLE_ID or AUTH_GOOGLE_SECRET in Convex env.",
			};
		}
		try {
			const oauth2 = new google.auth.OAuth2(
				clientId,
				clientSecret,
				args.redirectUri,
			);
			const { tokens } = await oauth2.getToken(args.code);
			if (!tokens.access_token || !tokens.refresh_token) {
				return {
					success: false,
					error: "Google did not return access_token or refresh_token.",
				};
			}
			const expiresAt = tokens.expiry_date
				? Math.floor(tokens.expiry_date / 1000)
				: Math.floor(Date.now() / 1000) + 3600;
			await ctx.runMutation(internal.sheetsQueries.setGoogleSheetsTokens, {
				accessToken: tokens.access_token,
				refreshToken: tokens.refresh_token,
				expiresAt,
			});
			return { success: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : "Exchange failed";
			return { success: false, error: message };
		}
	},
});

async function getValidAccessToken(
	ctx: GenericActionCtx<DataModel>,
): Promise<string | null> {
	const token = (await ctx.runQuery(
		internal.sheetsQueries.getGoogleSheetsToken,
		{},
	)) as {
		accessToken: string;
		refreshToken: string;
		expiresAt: number;
	} | null;
	if (!token) return null;
	const nowSec = Math.floor(Date.now() / 1000);
	if (token.expiresAt > nowSec + TOKEN_VALID_BUFFER_SEC)
		return token.accessToken;
	const clientId = process.env.AUTH_GOOGLE_ID;
	const clientSecret = process.env.AUTH_GOOGLE_SECRET;
	if (!clientId || !clientSecret) return token.accessToken;
	const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
	oauth2.setCredentials({
		access_token: token.accessToken,
		refresh_token: token.refreshToken,
	});
	const { credentials } = await oauth2.refreshAccessToken();
	if (credentials.access_token && credentials.expiry_date) {
		await ctx.runMutation(internal.sheetsQueries.setGoogleSheetsTokens, {
			accessToken: credentials.access_token,
			refreshToken: credentials.refresh_token ?? token.refreshToken,
			expiresAt: Math.floor(credentials.expiry_date / 1000),
		});
		return credentials.access_token;
	}
	return token.accessToken;
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

		const accessToken = await getValidAccessToken(ctx);
		if (!accessToken) {
			return {
				error:
					"No Google Sheets token. Run bun run auth:google-sheets from repo root.",
			};
		}

		try {
			const oauth2 = new google.auth.OAuth2();
			oauth2.setCredentials({ access_token: accessToken });
			const sheets = google.sheets({ version: "v4", auth: oauth2 });
			const res = await sheets.spreadsheets.values.get({
				spreadsheetId: args.sheetId,
				range: RANGE,
			});
			const rows = (res.data.values ?? []) as string[][];
			const events: ScheduleEvent[] = rows.map((row) => ({
				eventName: row[0] ?? "",
				rounds: row[1] ?? "",
			}));
			await ctx.runMutation(internal.sheetsQueries.setCachedSchedule, {
				sheetId: args.sheetId,
				events,
				fetchedAt: now,
			});
			return { events, fetchedAt: now };
		} catch (err) {
			return {
				error: err instanceof Error ? err.message : "Sheet unavailable",
			};
		}
	},
});
