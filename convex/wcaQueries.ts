import { createTokenMutations } from "./lib/oauthTokens";

const tokens = createTokenMutations("wcaTokens");

export const {
	setTokens: setWcaTokens,
	getToken: getWcaToken,
	getConnectionStatus: getWcaConnectionStatus,
} = tokens;
