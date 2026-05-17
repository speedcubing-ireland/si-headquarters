import type { TokenData } from "./types";

export type TokenRefreshDefinition = {
	tokenUrl: string;
	clientIdEnvVar: string;
	clientSecretEnvVar: string;
	authStyle?: "client_body" | "basic_auth";
	defaultExpiresInSec: number;
	useCreatedAt?: boolean;
};

export function createTokenRefreshDefinition(config: {
	tokenUrl: string;
	clientIdEnvVar: string;
	clientSecretEnvVar: string;
	defaultExpiresInSec: number;
	authStyle?: "client_body" | "basic_auth";
	useCreatedAt?: boolean;
}): TokenRefreshDefinition {
	return config;
}

export async function refreshTokenWithDefinition(
	definition: TokenRefreshDefinition,
	token: TokenData,
): Promise<TokenData | null> {
	if (!token.refreshToken.trim()) return null;

	const clientId = process.env[definition.clientIdEnvVar];
	const clientSecret = process.env[definition.clientSecretEnvVar];
	if (!clientId || !clientSecret) return null;

	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: token.refreshToken,
	});
	const headers: Record<string, string> = {
		"Content-Type": "application/x-www-form-urlencoded",
	};
	if (definition.authStyle === "basic_auth") {
		headers.Authorization = `Basic ${globalThis.btoa(`${clientId}:${clientSecret}`)}`;
	} else {
		body.set("client_id", clientId);
		body.set("client_secret", clientSecret);
	}

	const response = await fetch(definition.tokenUrl, {
		method: "POST",
		headers,
		body,
	});
	if (!response.ok) return null;

	const payload = (await response.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
		created_at?: number;
	};
	if (!payload.access_token) return null;

	const nowSec = Math.floor(Date.now() / 1000);
	const expiresAt =
		definition.useCreatedAt && payload.created_at
			? payload.created_at +
				(payload.expires_in ?? definition.defaultExpiresInSec)
			: nowSec + (payload.expires_in ?? definition.defaultExpiresInSec);

	return {
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token ?? token.refreshToken,
		expiresAt,
	};
}
