import { createTokenRefreshDefinition } from "../tokens/tokenDefinition";
import type { ServiceDefinition } from "../types";
import { createOAuthServiceDefinition } from "../oauth";

export const wcaTokenRefreshDefinition = createTokenRefreshDefinition({
	tokenUrl: "https://www.worldcubeassociation.org/oauth/token",
	clientIdEnvVar: "AUTH_WCA_ID",
	clientSecretEnvVar: "AUTH_WCA_SECRET",
	defaultExpiresInSec: 7200,
	useCreatedAt: true,
});

export const WCA_BASE = "https://www.worldcubeassociation.org";
export const WCA_API = `${WCA_BASE}/api/v0`;
export const WCA_OAUTH_SCOPE = "public email manage_competitions";

export const SEARCH_RESULTS_LIMIT = 10;
export const MY_COMPETITIONS_LIMIT = 20;

export type WcaCompetition = {
	id: string;
	name: string;
	city: string;
	country_iso2: string;
	start_date: string;
	end_date: string;
	event_ids: string[];
};

export async function wcaFetch(
	accessToken: string,
	path: string,
): Promise<unknown> {
	const response = await fetch(`${WCA_API}${path}`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!response.ok) {
		throw new Error(
			`WCA API ${path} failed: ${response.status} ${response.statusText}`,
		);
	}
	return response.json();
}

export function mapCompetitionResult(
	competition: WcaCompetition,
): WcaCompetition {
	return {
		id: competition.id,
		name: competition.name,
		city: competition.city ?? "",
		country_iso2: competition.country_iso2 ?? "",
		start_date: competition.start_date ?? "",
		end_date: competition.end_date ?? "",
		event_ids: competition.event_ids ?? [],
	};
}

const wcaOauthDefinition: ServiceDefinition["oauth"] =
	createOAuthServiceDefinition({
		providerDisplayName: "WCA",
		tokenDefinition: wcaTokenRefreshDefinition,
		authorizationUrl: `${WCA_BASE}/oauth/authorize`,
		scope: WCA_OAUTH_SCOPE,
		getMissingClientIdError: () => new Error("Missing AUTH_WCA_ID env var."),
		cli: {
			providerDisplayName: "WCA",
			successHeading: "WCA account linked",
			commandName: "auth wca",
			providerArg: "wca",
			port: 3848,
			redirectHost: "localhost",
			redirectHint: "Add it in your WCA OAuth application settings if needed.",
			missingAuthUrlMessage:
				"Could not get OAuth URL. Check AUTH_WCA_ID in Convex env.",
			useState: true,
		},
	});

export default {
	tokenDefinition: wcaTokenRefreshDefinition,
	oauth: wcaOauthDefinition,
} satisfies ServiceDefinition;
