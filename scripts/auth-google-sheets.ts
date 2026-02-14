#!/usr/bin/env bun

import { runOAuthTerminalFlow } from "./lib/oauth-cli.ts";

const PORT = 3847;
const REDIRECT_URI = `http://localhost:${PORT}`;

async function main() {
	const success = await runOAuthTerminalFlow({
		providerDisplayName: "Google Sheets",
		successHeading: "Google Sheets linked",
		commandName: "auth:google-sheets",
		port: PORT,
		redirectUri: REDIRECT_URI,
		redirectHint: "Add it in Google Cloud Console if needed.",
		authPath: "sheets:getGoogleOAuthUrl",
		exchangePath: "sheets:exchangeCodeAndStoreTokens",
		missingAuthUrlMessage:
			"Could not get OAuth URL. Check AUTH_GOOGLE_ID in Convex env.",
	});
	process.exit(success ? 0 : 1);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
