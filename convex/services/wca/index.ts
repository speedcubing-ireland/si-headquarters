import { createTokenRefreshDefinition } from "../tokens/tokenDefinition";
import type { ServiceDefinition } from "../types";

export const wcaTokenRefreshDefinition = createTokenRefreshDefinition({
	tokenUrl: "https://www.worldcubeassociation.org/oauth/token",
	clientIdEnvVar: "AUTH_WCA_ID",
	clientSecretEnvVar: "AUTH_WCA_SECRET",
	defaultExpiresInSec: 7200,
	useCreatedAt: true,
});

export default {
	tokenDefinition: wcaTokenRefreshDefinition,
} satisfies ServiceDefinition;
