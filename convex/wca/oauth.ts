import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { WCA_BASE, WCA_OAUTH_SCOPE, requireVolunteerAction } from "./client";

export const getWcaOAuthUrl = action({
	args: { redirectUri: v.string(), cliToken: v.optional(v.string()) },
	returns: v.object({ url: v.string() }),
	handler: async (ctx, args) => {
		await requireVolunteerAction(ctx, args.cliToken);
		const clientId = process.env.AUTH_WCA_ID;
		if (!clientId) throw new Error("Missing AUTH_WCA_ID env var.");

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
			return {
				success: false,
				error: `Token exchange failed: ${await res.text()}`,
			};
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

		await ctx.runMutation(internal.services.tokens.setTokens, {
			service: "wca",
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token ?? "",
			expiresAt,
		});

		return { success: true };
	},
});
