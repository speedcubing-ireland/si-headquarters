import { internalMutation, internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUserId } from "../auth";

const TOKEN_EXPIRY_BUFFER_SEC = 5 * 60;

export function createTokenMutations(
	tableName: "googleSheetsTokens" | "wcaTokens",
) {
	return {
		setTokens: internalMutation({
			args: {
				accessToken: v.string(),
				refreshToken: v.string(),
				expiresAt: v.number(),
			},
			returns: v.null(),
			handler: async (ctx, args) => {
				const now = Date.now();
				const existing = await ctx.db.query(tableName).first();
				const row = {
					accessToken: args.accessToken,
					refreshToken: args.refreshToken,
					expiresAt: args.expiresAt,
					updatedAt: now,
				};
				if (existing) {
					await ctx.db.patch(tableName, existing._id, row);
				} else {
					await ctx.db.insert(tableName, row);
				}
				return null;
			},
		}),

		getToken: internalQuery({
			args: {},
			returns: v.union(
				v.object({
					accessToken: v.string(),
					refreshToken: v.string(),
					expiresAt: v.number(),
				}),
				v.null(),
			),
			handler: async (ctx) => {
				const row = await ctx.db.query(tableName).first();
				if (!row) return null;
				return {
					accessToken: row.accessToken,
					refreshToken: row.refreshToken,
					expiresAt: row.expiresAt,
				};
			},
		}),

		getConnectionStatus: query({
			args: { nowSec: v.optional(v.number()) },
			returns: v.object({ connected: v.boolean() }),
			handler: async (ctx, args) => {
				await requireUserId(ctx);
				void args.nowSec;
				const row = await ctx.db.query(tableName).first();
				const nowSec = Math.floor(Date.now() / 1000);
				const hasUnexpiredAccessToken =
					row != null && row.expiresAt > nowSec - TOKEN_EXPIRY_BUFFER_SEC;
				const hasRefreshToken =
					row != null && row.refreshToken.trim().length > 0;
				const connected = hasUnexpiredAccessToken || hasRefreshToken;
				return { connected };
			},
		}),
	};
}
