import type { TokenRefreshDefinition } from "./tokens/tokenDefinition";
import type { TokenData } from "./tokens/types";

export type OAuthCliDefinition = {
	providerDisplayName: string;
	successHeading: string;
	commandName: string;
	providerArg: string;
	aliases?: string[];
	port: number;
	redirectHost: "localhost" | "127.0.0.1";
	redirectHint?: string;
	missingAuthUrlMessage: string;
	usePkce?: boolean;
	useState?: boolean;
};

export type OAuthServiceDefinition = {
	getAuthorizationUrl(args: {
		redirectUri: string;
		state?: string;
		codeChallenge?: string;
	}): {
		url: string;
		state: string;
	};
	exchangeAuthorizationCode(args: {
		code: string;
		redirectUri: string;
		codeVerifier?: string;
	}): Promise<TokenData>;
	cli: OAuthCliDefinition;
};

export type ServiceDefinition = {
	tokenDefinition: TokenRefreshDefinition;
	oauth: OAuthServiceDefinition;
};
