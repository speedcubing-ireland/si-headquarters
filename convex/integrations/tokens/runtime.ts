import type { DataModel } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import type { GenericActionCtx } from "convex/server";
import type { ServiceType, TokenData } from "./types";

export async function getServiceAccessToken(
	ctx: GenericActionCtx<DataModel>,
	service: ServiceType,
): Promise<string | null> {
	return await ctx.runAction(internal.integrations.tokens.getValidAccessToken, {
		service,
	});
}

export async function setServiceTokens(
	ctx: GenericActionCtx<DataModel>,
	args: {
		service: ServiceType;
		token: TokenData;
	},
): Promise<void> {
	await ctx.runMutation(internal.integrations.tokens.setTokens, {
		service: args.service,
		accessToken: args.token.accessToken,
		refreshToken: args.token.refreshToken,
		expiresAt: args.token.expiresAt,
	});
}
