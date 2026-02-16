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
export const WCA_OAUTH_SCOPE = "public email manage_competitions";

export const SEARCH_RESULTS_LIMIT = 10;
export const MY_COMPETITIONS_LIMIT = 20;

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
