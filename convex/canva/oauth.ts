"use node";

import { ConvexError } from "convex/values";

export const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_SCOPE = [
	"design:content:write",
	"design:meta:read",
	"folder:read",
	"folder:write",
	"brandtemplate:meta:read",
	"brandtemplate:content:read",
].join(" ");

export type CanvaToken = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
};

function getCanvaCredentials() {
	const clientId = process.env.AUTH_CANVA_ID;
	const clientSecret = process.env.AUTH_CANVA_SECRET;
	if (!clientId || !clientSecret) {
		throw new ConvexError({
			code: "PRECONDITION_FAILED",
			message: "Missing AUTH_CANVA_ID or AUTH_CANVA_SECRET in Convex env.",
		});
	}
	return { clientId, clientSecret };
}

function buildBasicAuthHeader(clientId: string, clientSecret: string) {
	const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
		"base64",
	);
	return `Basic ${credentials}`;
}

export async function exchangeToken(args: {
	grantType: "authorization_code" | "refresh_token";
	code?: string;
	refreshToken?: string;
	redirectUri?: string;
	codeVerifier?: string;
}) {
	const { clientId, clientSecret } = getCanvaCredentials();
	const headers = {
		Authorization: buildBasicAuthHeader(clientId, clientSecret),
		"Content-Type": "application/x-www-form-urlencoded",
	};
	const body = new URLSearchParams({
		grant_type: args.grantType,
	});
	if (args.code) body.set("code", args.code);
	if (args.refreshToken) body.set("refresh_token", args.refreshToken);
	if (args.redirectUri) body.set("redirect_uri", args.redirectUri);
	if (args.codeVerifier) body.set("code_verifier", args.codeVerifier);

	const response = await fetch(CANVA_TOKEN_URL, {
		method: "POST",
		headers,
		body,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `Canva token exchange failed: ${text}`,
		});
	}

	const payload = (await response.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
	};

	if (!payload.access_token) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Canva did not return an access token.",
		});
	}

	return {
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token ?? args.refreshToken ?? "",
		expiresAt: Math.floor(Date.now() / 1000) + (payload.expires_in ?? 14_400),
	} satisfies CanvaToken;
}

export function buildCanvaOAuthUrl(args: {
	redirectUri: string;
	clientId: string;
	codeChallenge?: string;
	state: string;
}) {
	const url = new URL(CANVA_AUTH_URL);
	url.searchParams.set("client_id", args.clientId);
	url.searchParams.set("redirect_uri", args.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", CANVA_SCOPE);
	url.searchParams.set("state", args.state);
	if (args.codeChallenge) {
		url.searchParams.set("code_challenge", args.codeChallenge);
		url.searchParams.set("code_challenge_method", "S256");
	}
	return url.toString();
}

export function getCanvaClientId() {
	return getCanvaCredentials().clientId;
}
