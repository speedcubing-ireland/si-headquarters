import type { ServiceType } from "../tokens/types";
import services from "../services";
import type { OAuthCliDefinition } from "../types";

export type OAuthTerminalFlowService = ServiceType;

export type OAuthTerminalFlowServiceConfig = OAuthCliDefinition & {
	service: OAuthTerminalFlowService;
};

const serviceList = Object.keys(services) as OAuthTerminalFlowService[];

function getAllOAuthTerminalFlowServiceConfigs(): OAuthTerminalFlowServiceConfig[] {
	return serviceList.map((service) => ({
		service,
		...services[service].oauth.cli,
	}));
}

export function getOAuthTerminalFlowServiceConfig(
	service: OAuthTerminalFlowService,
): OAuthTerminalFlowServiceConfig {
	return {
		service,
		...services[service].oauth.cli,
	};
}

export function parseOAuthTerminalFlowServiceArg(
	value: string | undefined,
): OAuthTerminalFlowService | null {
	if (!value) return null;
	const normalized = value.trim().toLowerCase();

	for (const config of getAllOAuthTerminalFlowServiceConfigs()) {
		if (normalized === config.service) {
			return config.service;
		}
		if (normalized === config.providerArg.toLowerCase()) {
			return config.service;
		}
		if (config.aliases?.some((alias) => alias.toLowerCase() === normalized)) {
			return config.service;
		}
	}

	return null;
}

export function getOAuthTerminalFlowUsageArgList(): string {
	return getOAuthTerminalFlowUsageArgs().join(" | ");
}

export function getOAuthTerminalFlowUsageArgs(): string[] {
	return getAllOAuthTerminalFlowServiceConfigs().map(
		(config) => config.providerArg,
	);
}

export function getOAuthTerminalFlowRedirectUri(
	config: Pick<OAuthTerminalFlowServiceConfig, "port" | "redirectHost">,
): string {
	return `http://${config.redirectHost}:${config.port}`;
}
