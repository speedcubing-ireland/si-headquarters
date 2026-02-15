import { createTokenRefreshDefinition } from "../tokens/tokenDefinition";
import type { ServiceDefinition } from "../types";

export const googleTokenRefreshDefinition = createTokenRefreshDefinition({
	tokenUrl: "https://oauth2.googleapis.com/token",
	clientIdEnvVar: "AUTH_GOOGLE_ID",
	clientSecretEnvVar: "AUTH_GOOGLE_SECRET",
	defaultExpiresInSec: 3600,
});

export default {
	tokenDefinition: googleTokenRefreshDefinition,
} satisfies ServiceDefinition;
