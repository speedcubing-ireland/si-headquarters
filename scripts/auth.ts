#!/usr/bin/env bun

import {
	getOAuthTerminalFlowUsageArgList,
	getOAuthTerminalFlowUsageArgs,
	parseOAuthTerminalFlowServiceArg,
	runServiceOAuthTerminalFlow,
} from "./lib/oauth-service.ts";

function printUsage() {
	const providers = getOAuthTerminalFlowUsageArgs();
	const exampleLines = providers.map(
		(provider) => `  bun run auth ${provider}`,
	);
	console.error(
		[
			"Usage:",
			"  bun run auth <provider>",
			"",
			`Providers: ${getOAuthTerminalFlowUsageArgList()}`,
			"",
			"Examples:",
			...exampleLines,
			...(providers.length > 0
				? [`  CONVEX_PROD=1 bun run auth ${providers[0]}`]
				: []),
		].join("\n"),
	);
}

async function main() {
	const rawServiceArg = Bun.argv[2];
	const service = parseOAuthTerminalFlowServiceArg(rawServiceArg);
	if (!service) {
		printUsage();
		process.exit(1);
	}

	const success = await runServiceOAuthTerminalFlow(service);
	process.exit(success ? 0 : 1);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
