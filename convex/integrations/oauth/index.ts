import type { TokenRefreshDefinition } from "../tokens/tokenDefinition";
import type { TokenData } from "../tokens/types";
import type { OAuthCliDefinition, OAuthServiceDefinition } from "../types";

export type OAuthAuthorizeUrlArgs = {
	authorizationUrl: string;
	clientId: string;
	redirectUri: string;
	scope: string;
	state?: string;
	extraParams?: Record<string, string | undefined>;
};

type CreateOAuthServiceDefinitionArgs = {
	providerDisplayName: string;
	tokenDefinition: TokenRefreshDefinition;
	authorizationUrl: string;
	scope: string;
	cli: OAuthCliDefinition;
	requireRefreshToken?: boolean;
	getMissingClientIdError: () => Error;
	getAuthorizeExtraParams?: (args: {
		codeChallenge?: string;
	}) => Record<string, string | undefined>;
};

type AuthorizationCodeExchangeArgs = {
	providerDisplayName: string;
	tokenDefinition: TokenRefreshDefinition;
	code: string;
	redirectUri: string;
	codeVerifier?: string;
	requireRefreshToken?: boolean;
};

type OAuthTokenPayload = {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
	created_at?: number;
};

function toBasicAuthHeader(clientId: string, clientSecret: string): string {
	return `Basic ${globalThis.btoa(`${clientId}:${clientSecret}`)}`;
}

function getServiceClientCredentials(tokenDefinition: TokenRefreshDefinition) {
	const clientId = process.env[tokenDefinition.clientIdEnvVar];
	const clientSecret = process.env[tokenDefinition.clientSecretEnvVar];
	if (!clientId || !clientSecret) {
		return null;
	}
	return { clientId, clientSecret };
}

export function getServiceClientId(
	tokenDefinition: TokenRefreshDefinition,
): string | null {
	return process.env[tokenDefinition.clientIdEnvVar] ?? null;
}

export function buildOAuthAuthorizeUrl(args: OAuthAuthorizeUrlArgs): string {
	const url = new URL(args.authorizationUrl);
	url.searchParams.set("client_id", args.clientId);
	url.searchParams.set("redirect_uri", args.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", args.scope);
	if (args.state) {
		url.searchParams.set("state", args.state);
	}
	for (const [key, value] of Object.entries(args.extraParams ?? {})) {
		if (value !== undefined) {
			url.searchParams.set(key, value);
		}
	}
	return url.toString();
}

export function createOAuthServiceDefinition(
	args: CreateOAuthServiceDefinitionArgs,
): OAuthServiceDefinition {
	return {
		getAuthorizationUrl({ redirectUri, state, codeChallenge }) {
			const clientId = getServiceClientId(args.tokenDefinition);
			if (!clientId) {
				throw args.getMissingClientIdError();
			}
			const nextState = state ?? crypto.randomUUID();
			return {
				url: buildOAuthAuthorizeUrl({
					authorizationUrl: args.authorizationUrl,
					clientId,
					redirectUri,
					scope: args.scope,
					state: nextState,
					extraParams: args.getAuthorizeExtraParams?.({ codeChallenge }),
				}),
				state: nextState,
			};
		},
		async exchangeAuthorizationCode({ code, redirectUri, codeVerifier }) {
			return await exchangeAuthorizationCodeWithDefinition({
				providerDisplayName: args.providerDisplayName,
				tokenDefinition: args.tokenDefinition,
				code,
				redirectUri,
				codeVerifier,
				requireRefreshToken: args.requireRefreshToken,
			});
		},
		cli: args.cli,
	};
}

export async function exchangeAuthorizationCodeWithDefinition(
	args: AuthorizationCodeExchangeArgs,
): Promise<TokenData> {
	const credentials = getServiceClientCredentials(args.tokenDefinition);
	if (!credentials) {
		throw new Error(
			`Missing ${args.tokenDefinition.clientIdEnvVar} or ${args.tokenDefinition.clientSecretEnvVar} in Convex env.`,
		);
	}

	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code: args.code,
		redirect_uri: args.redirectUri,
	});
	if (args.codeVerifier) {
		body.set("code_verifier", args.codeVerifier);
	}

	const headers: Record<string, string> = {
		"Content-Type": "application/x-www-form-urlencoded",
	};
	if (args.tokenDefinition.authStyle === "basic_auth") {
		headers.Authorization = toBasicAuthHeader(
			credentials.clientId,
			credentials.clientSecret,
		);
	} else {
		body.set("client_id", credentials.clientId);
		body.set("client_secret", credentials.clientSecret);
	}

	const response = await fetch(args.tokenDefinition.tokenUrl, {
		method: "POST",
		headers,
		body,
	});
	if (!response.ok) {
		throw new Error(
			`${args.providerDisplayName} token exchange failed (HTTP ${response.status}).`,
		);
	}

	const payload = (await response.json()) as OAuthTokenPayload;
	if (!payload.access_token) {
		throw new Error(
			`${args.providerDisplayName} did not return an access token.`,
		);
	}
	if (args.requireRefreshToken && !payload.refresh_token) {
		throw new Error(
			`${args.providerDisplayName} did not return a refresh token.`,
		);
	}

	const nowSec = Math.floor(Date.now() / 1000);
	const expiresAt =
		args.tokenDefinition.useCreatedAt && payload.created_at
			? payload.created_at +
				(payload.expires_in ?? args.tokenDefinition.defaultExpiresInSec)
			: nowSec +
				(payload.expires_in ?? args.tokenDefinition.defaultExpiresInSec);

	return {
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token ?? "",
		expiresAt,
	};
}
