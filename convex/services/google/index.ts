import { createTokenRefreshDefinition } from "../tokens/tokenDefinition";
import type { ServiceDefinition } from "../types";
import { createOAuthServiceDefinition } from "../oauth";

export const googleTokenRefreshDefinition = createTokenRefreshDefinition({
	tokenUrl: "https://oauth2.googleapis.com/token",
	clientIdEnvVar: "AUTH_GOOGLE_ID",
	clientSecretEnvVar: "AUTH_GOOGLE_SECRET",
	defaultExpiresInSec: 3600,
});

export const GOOGLE_OAUTH_SCOPE =
	"https://www.googleapis.com/auth/spreadsheets.readonly";
const googleOauthDefinition: ServiceDefinition["oauth"] =
	createOAuthServiceDefinition({
		providerDisplayName: "Google",
		tokenDefinition: googleTokenRefreshDefinition,
		authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		scope: GOOGLE_OAUTH_SCOPE,
		requireRefreshToken: true,
		getMissingClientIdError: () =>
			new Error(
				"Missing AUTH_GOOGLE_ID. Set it in Convex dashboard (same as Google sign-in).",
			),
		getAuthorizeExtraParams: () => ({
			access_type: "offline",
			prompt: "consent",
		}),
		cli: {
			providerDisplayName: "Google Sheets",
			successHeading: "Google Sheets linked",
			commandName: "auth google-sheets",
			providerArg: "google-sheets",
			aliases: ["google"],
			port: 3847,
			redirectHost: "localhost",
			redirectHint: "Add it in Google Cloud Console if needed.",
			missingAuthUrlMessage:
				"Could not get OAuth URL. Check AUTH_GOOGLE_ID in Convex env.",
			useState: true,
		},
	});

export default {
	tokenDefinition: googleTokenRefreshDefinition,
	oauth: googleOauthDefinition,
} satisfies ServiceDefinition;
