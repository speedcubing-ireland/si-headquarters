import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	query,
} from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "../core/auth";
import { internal } from "../_generated/api";
import { requireDirectorAction } from "../lib/oauth";
import schema from "../schema";
import { refreshTokenWithDefinition } from "./tokens/tokenDefinition";
import type { ServiceType, TokenData } from "./tokens/types";
import services from "./services";

const TOKEN_EXPIRY_BUFFER_SEC = 5 * 60;

const serviceTokensFields = schema.tables.serviceTokens.validator.fields;
const serviceValidator = serviceTokensFields.service;
const tokenDataValidator = {
	accessToken: serviceTokensFields.accessToken,
	refreshToken: serviceTokensFields.refreshToken,
	expiresAt: serviceTokensFields.expiresAt,
};

const tokenDataObjectValidator = v.object(tokenDataValidator);
const tokenCheckResultValidator = v.object({
	service: serviceValidator,
	status: v.union(
		v.literal("valid"),
		v.literal("invalid"),
		v.literal("missing"),
	),
	message: v.string(),
});

const serviceTypes: ServiceType[] = ["google", "wca", "canva"];

function hasUsableAccessToken(token: TokenData, nowSec: number): boolean {
	return token.expiresAt > nowSec + TOKEN_EXPIRY_BUFFER_SEC;
}

async function refreshTokenForService(
	service: ServiceType,
	token: TokenData,
): Promise<TokenData | null> {
	return await refreshTokenWithDefinition(
		services[service].tokenDefinition,
		token,
	);
}

export const setTokens = internalMutation({
	args: {
		service: serviceValidator,
		...tokenDataValidator,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now();
		const existing = await ctx.db
			.query("serviceTokens")
			.withIndex("by_service", (q) => q.eq("service", args.service))
			.first();

		const row = {
			service: args.service,
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			expiresAt: args.expiresAt,
			updatedAt: now,
		};
		if (existing) {
			await ctx.db.patch("serviceTokens", existing._id, row);
		} else {
			await ctx.db.insert("serviceTokens", row);
		}
		return null;
	},
});

export const getToken = internalQuery({
	args: { service: serviceValidator },
	returns: v.union(tokenDataObjectValidator, v.null()),
	handler: async (ctx, args) => {
		const row = await ctx.db
			.query("serviceTokens")
			.withIndex("by_service", (q) => q.eq("service", args.service))
			.first();
		if (!row) return null;
		return {
			accessToken: row.accessToken,
			refreshToken: row.refreshToken,
			expiresAt: row.expiresAt,
		};
	},
});

export const getConnectionStatus = query({
	args: {
		service: serviceValidator,
		nowSec: v.optional(v.number()),
	},
	returns: v.object({ connected: v.boolean() }),
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		void args.nowSec;
		const row = await ctx.db
			.query("serviceTokens")
			.withIndex("by_service", (q) => q.eq("service", args.service))
			.first();
		if (!row) return { connected: false };

		const nowSec = Math.floor(Date.now() / 1000);
		const hasUnexpiredAccessToken =
			row.expiresAt > nowSec - TOKEN_EXPIRY_BUFFER_SEC;
		const hasRefreshToken = row.refreshToken.trim().length > 0;
		return { connected: hasUnexpiredAccessToken || hasRefreshToken };
	},
});

export const getValidAccessToken = internalAction({
	args: { service: serviceValidator },
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args): Promise<string | null> => {
		const token = await ctx.runQuery(internal.integrations.tokens.getToken, {
			service: args.service,
		});
		if (!token) return null;

		const nowSec = Math.floor(Date.now() / 1000);
		if (hasUsableAccessToken(token, nowSec)) {
			return token.accessToken;
		}

		const refreshed = await refreshTokenForService(args.service, token);
		if (refreshed) {
			await ctx.runMutation(internal.integrations.tokens.setTokens, {
				service: args.service,
				accessToken: refreshed.accessToken,
				refreshToken: refreshed.refreshToken,
				expiresAt: refreshed.expiresAt,
			});
			return refreshed.accessToken;
		}

		const recheckedToken = await ctx.runQuery(
			internal.integrations.tokens.getToken,
			{
				service: args.service,
			},
		);
		if (recheckedToken && hasUsableAccessToken(recheckedToken, nowSec)) {
			return recheckedToken.accessToken;
		}

		return null;
	},
});

export const checkConnections = action({
	args: {},
	returns: v.object({
		checkedAt: v.number(),
		results: v.array(tokenCheckResultValidator),
	}),
	handler: async (ctx) => {
		await requireDirectorAction(ctx);

		const results: Array<{
			service: ServiceType;
			status: "valid" | "invalid" | "missing";
			message: string;
		}> = [];
		for (const service of serviceTypes) {
			const token: TokenData | null = await ctx.runQuery(
				internal.integrations.tokens.getToken,
				{ service },
			);
			if (!token) {
				results.push({
					service,
					status: "missing",
					message: "No token saved for this service.",
				});
				continue;
			}
			if (!token.refreshToken.trim()) {
				results.push({
					service,
					status: "invalid",
					message: "Missing refresh token. Reconnect this service.",
				});
				continue;
			}

			const refreshed = await refreshTokenForService(service, token);
			if (!refreshed) {
				results.push({
					service,
					status: "invalid",
					message: "Refresh failed. Reconnect this service.",
				});
				continue;
			}

			await ctx.runMutation(internal.integrations.tokens.setTokens, {
				service,
				accessToken: refreshed.accessToken,
				refreshToken: refreshed.refreshToken,
				expiresAt: refreshed.expiresAt,
			});
			results.push({
				service,
				status: "valid",
				message: "Refresh successful.",
			});
		}

		return {
			checkedAt: Date.now(),
			results,
		};
	},
});
