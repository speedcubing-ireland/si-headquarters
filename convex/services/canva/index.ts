import { createTokenRefreshDefinition } from "../tokens/tokenDefinition";
import type { ServiceDefinition } from "../types";

export const canvaTokenRefreshDefinition = createTokenRefreshDefinition({
	tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
	clientIdEnvVar: "AUTH_CANVA_ID",
	clientSecretEnvVar: "AUTH_CANVA_SECRET",
	defaultExpiresInSec: 14_400,
	authStyle: "basic_auth",
});

export default {
	tokenDefinition: canvaTokenRefreshDefinition,
} satisfies ServiceDefinition;
