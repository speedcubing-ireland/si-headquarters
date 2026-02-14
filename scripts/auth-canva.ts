#!/usr/bin/env bun

import { runOAuthTerminalFlow } from "./lib/oauth-cli.ts";

const PORT = 3849;
// Canva requires loopback redirects to use 127.0.0.1, not localhost.
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;

async function main() {
	const success = await runOAuthTerminalFlow({
		providerDisplayName: "Canva",
		successHeading: "Canva account linked",
		commandName: "auth:canva",
		port: PORT,
		redirectUri: REDIRECT_URI,
		authPath: "canva:getCanvaOAuthUrl",
		exchangePath: "canva:exchangeCodeAndStoreTokens",
		missingAuthUrlMessage:
			"Could not get OAuth URL. Check AUTH_CANVA_ID in Convex env.",
		usePkce: true,
		useState: true,
	});
	process.exit(success ? 0 : 1);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
