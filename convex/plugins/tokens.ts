import { v } from "convex/values"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { mutation } from "../_generated/server"

async function loadTokenRow(
  ctx: QueryCtx | MutationCtx,
  service: string,
) {
  return await ctx.db
    .query("serviceTokens")
    .withIndex("by_service", (q) =>
      q.eq("service", service)
    )
    .unique()
}

export const setToken = mutation({
  args: {
    service: v.string(),
    token: v.object({
      accessToken: v.string(),
      refreshToken: v.string(),
      expiresAt: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await loadTokenRow(ctx, args.service)
    const row = {
      service: args.service,
      accessToken: args.token.accessToken,
      refreshToken: args.token.refreshToken,
      expiresAt: args.token.expiresAt,
    }
    if (existing !== null) {
      await ctx.db.patch("serviceTokens", existing._id, row)
    } else {
      await ctx.db.insert("serviceTokens", row)
    }
    return null
  },
})
