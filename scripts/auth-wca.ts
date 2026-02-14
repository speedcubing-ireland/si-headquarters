#!/usr/bin/env bun

import { runOAuthTerminalFlow } from "./lib/oauth-cli.ts";

const PORT = 3848;
const REDIRECT_URI = `http://localhost:${PORT}`;

async function main() {
	const success = await runOAuthTerminalFlow({
		providerDisplayName: "WCA",
		successHeading: "WCA account linked",
		commandName: "auth:wca",
		port: PORT,
		redirectUri: REDIRECT_URI,
		redirectHint: "Add it in your WCA OAuth application settings if needed.",
		authPath: "wca:getWcaOAuthUrl",
		exchangePath: "wca:exchangeCodeAndStoreTokens",
		missingAuthUrlMessage:
			"Could not get OAuth URL. Check AUTH_WCA_ID in Convex env.",
	});
	process.exit(success ? 0 : 1);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
