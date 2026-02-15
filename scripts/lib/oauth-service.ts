import {
	getOAuthTerminalFlowRedirectUri,
	getOAuthTerminalFlowServiceConfig,
	getOAuthTerminalFlowUsageArgs,
	getOAuthTerminalFlowUsageArgList,
	parseOAuthTerminalFlowServiceArg,
	type OAuthTerminalFlowService,
} from "../../convex/services/oauth/providers.ts";
import { runOAuthTerminalFlow } from "./oauth-cli.ts";

export async function runServiceOAuthTerminalFlow(
	service: OAuthTerminalFlowService,
): Promise<boolean> {
	const serviceConfig = getOAuthTerminalFlowServiceConfig(service);
	const redirectUri = getOAuthTerminalFlowRedirectUri(serviceConfig);

	return await runOAuthTerminalFlow({
		providerDisplayName: serviceConfig.providerDisplayName,
		successHeading: serviceConfig.successHeading,
		commandName: serviceConfig.commandName,
		port: serviceConfig.port,
		redirectUri,
		redirectHint: serviceConfig.redirectHint,
		authPath: "services/oauth/flow:getOAuthUrl",
		exchangePath: "services/oauth/flow:exchangeCodeAndStoreTokens",
		authArgs: { service },
		exchangeArgs: { service },
		missingAuthUrlMessage: serviceConfig.missingAuthUrlMessage,
		usePkce: serviceConfig.usePkce,
		useState: serviceConfig.useState,
	});
}

export {
	getOAuthTerminalFlowUsageArgList,
	getOAuthTerminalFlowUsageArgs,
	parseOAuthTerminalFlowServiceArg,
};
