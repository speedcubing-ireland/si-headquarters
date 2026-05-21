import { createTokenRefreshDefinition } from "../tokens/tokenDefinition";
import type { ServiceDefinition } from "../types";
import { createOAuthServiceDefinition } from "../oauth";
import { ConvexError } from "convex/values";

export const canvaTokenRefreshDefinition = createTokenRefreshDefinition({
	tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
	clientIdEnvVar: "SERVICE_CANVA_ID",
	clientSecretEnvVar: "SERVICE_CANVA_SECRET",
	defaultExpiresInSec: 14_400,
	authStyle: "basic_auth",
});

export const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_SCOPE = [
	"design:content:write",
	"design:meta:read",
	"folder:read",
	"folder:write",
	"brandtemplate:meta:read",
	"brandtemplate:content:read",
].join(" ");
const canvaOauthDefinition: ServiceDefinition["oauth"] =
	createOAuthServiceDefinition({
		providerDisplayName: "Canva",
		tokenDefinition: canvaTokenRefreshDefinition,
		authorizationUrl: CANVA_AUTH_URL,
		scope: CANVA_SCOPE,
		getMissingClientIdError: () =>
			new ConvexError({
				code: "PRECONDITION_FAILED",
				message: "Missing SERVICE_CANVA_ID in Convex env.",
			}),
		getAuthorizeExtraParams: ({ codeChallenge }) =>
			codeChallenge
				? {
						code_challenge: codeChallenge,
						code_challenge_method: "S256",
					}
				: {},
		cli: {
			providerDisplayName: "Canva",
			successHeading: "Canva account linked",
			commandName: "auth canva",
			providerArg: "canva",
			port: 3849,
			redirectHost: "127.0.0.1",
			missingAuthUrlMessage:
				"Could not get OAuth URL. Check SERVICE_CANVA_ID in Convex env.",
			usePkce: true,
			useState: true,
		},
	});

export default {
	tokenDefinition: canvaTokenRefreshDefinition,
	oauth: canvaOauthDefinition,
} satisfies ServiceDefinition;
