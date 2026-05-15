import { v } from "convex/values";
import { action } from "../../_generated/server";
import schema from "../../schema";
import { requireDirectorAction } from "../../lib/oauth";
import services from "../services";
import { setServiceTokens } from "../tokens/runtime";

const serviceValidator = schema.tables.serviceTokens.validator.fields.service;

export const getOAuthUrl = action({
	args: {
		service: serviceValidator,
		redirectUri: v.string(),
		state: v.optional(v.string()),
		codeChallenge: v.optional(v.string()),
		cliToken: v.optional(v.string()),
	},
	returns: v.object({
		url: v.string(),
		state: v.string(),
	}),
	handler: async (ctx, args) => {
		await requireDirectorAction(ctx, args.cliToken);
		return services[args.service].oauth.getAuthorizationUrl({
			redirectUri: args.redirectUri,
			state: args.state,
			codeChallenge: args.codeChallenge,
		});
	},
});

export const exchangeCodeAndStoreTokens = action({
	args: {
		service: serviceValidator,
		code: v.string(),
		redirectUri: v.string(),
		codeVerifier: v.optional(v.string()),
		cliToken: v.optional(v.string()),
	},
	returns: v.object({
		success: v.boolean(),
		error: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		await requireDirectorAction(ctx, args.cliToken);
		try {
			const token = await services[
				args.service
			].oauth.exchangeAuthorizationCode({
				code: args.code,
				redirectUri: args.redirectUri,
				codeVerifier: args.codeVerifier,
			});
			await setServiceTokens(ctx, { service: args.service, token });
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "OAuth exchange failed.",
			};
		}
	},
});
