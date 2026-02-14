import { createTokenMutations } from "./lib/oauthTokens";

const tokens = createTokenMutations("canvaTokens");

export const {
	setTokens: setCanvaTokens,
	getToken: getCanvaToken,
	getConnectionStatus: getCanvaConnectionStatus,
} = tokens;
