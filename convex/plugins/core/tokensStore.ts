import { v } from "convex/values"
import { internalMutation, internalQuery } from "@/convex/_generated/server"
import { oauthService } from "@/convex/plugins/core/validators"

export const loadToken = internalQuery({
  args: { service: oauthService },
  returns: v.union(
    v.object({
      accessToken: v.string(),
      refreshToken: v.string(),
      expiresAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("serviceTokens")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .unique()
    if (row === null) {
      return null
    }
    return {
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      expiresAt: row.expiresAt,
    }
  },
})

export const saveToken = internalMutation({
  args: {
    service: oauthService,
    token: v.object({
      accessToken: v.string(),
      refreshToken: v.string(),
      expiresAt: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("serviceTokens")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .unique()
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
