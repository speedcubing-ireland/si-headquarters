import { v } from "convex/values"
import {
  internalMutation,
  internalQuery,
  query,
} from "@/convex/_generated/server"
import { oauthService } from "@/convex/integrations/validators"
import { requireDirector } from "@/convex/permissions/principal"
import { OAUTH_PLUGINS } from "@/convex/plugins/oauthRegistry"

const storedTokenValidator = v.object({
  accessToken: v.string(),
  refreshToken: v.string(),
  expiresAt: v.number(),
})

const saveRefreshedTokenResultValidator = v.union(
  v.object({ status: v.literal("saved") }),
  v.object({
    status: v.literal("superseded"),
    token: storedTokenValidator,
  }),
  v.object({ status: v.literal("missing") })
)

const serviceAccountStatusValidator = v.object({
  service: oauthService,
  displayName: v.string(),
  providerArg: v.string(),
  connected: v.boolean(),
  connectedAt: v.union(v.number(), v.null()),
  expiresAt: v.union(v.number(), v.null()),
  hasRefreshToken: v.boolean(),
})

export const loadToken = internalQuery({
  args: { service: oauthService },
  returns: v.union(storedTokenValidator, v.null()),
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

export const loadTokenForDirector = internalQuery({
  args: { service: oauthService },
  returns: v.union(storedTokenValidator, v.null()),
  handler: async (ctx, args) => {
    await requireDirector(ctx)
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

export const listServiceAccounts = query({
  args: {},
  returns: v.array(serviceAccountStatusValidator),
  handler: async (ctx) => {
    await requireDirector(ctx)
    return await Promise.all(
      OAUTH_PLUGINS.map(async (plugin) => {
        const row = await ctx.db
          .query("serviceTokens")
          .withIndex("by_service", (q) => q.eq("service", plugin.meta.service))
          .unique()
        return {
          service: plugin.meta.service,
          displayName: plugin.client.displayName,
          providerArg: plugin.meta.cli.providerArg,
          connected: row !== null,
          connectedAt: row?._creationTime ?? null,
          expiresAt: row?.expiresAt ?? null,
          hasRefreshToken: (row?.refreshToken ?? "") !== "",
        }
      })
    )
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

export const saveRefreshedToken = internalMutation({
  args: {
    service: oauthService,
    expectedToken: storedTokenValidator,
    token: storedTokenValidator,
  },
  returns: saveRefreshedTokenResultValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("serviceTokens")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .unique()
    if (existing === null) {
      return { status: "missing" as const }
    }

    if (
      existing.accessToken !== args.expectedToken.accessToken ||
      existing.refreshToken !== args.expectedToken.refreshToken ||
      existing.expiresAt !== args.expectedToken.expiresAt
    ) {
      return {
        status: "superseded" as const,
        token: {
          accessToken: existing.accessToken,
          refreshToken: existing.refreshToken,
          expiresAt: existing.expiresAt,
        },
      }
    }

    await ctx.db.patch("serviceTokens", existing._id, {
      accessToken: args.token.accessToken,
      refreshToken: args.token.refreshToken,
      expiresAt: args.token.expiresAt,
    })
    return { status: "saved" as const }
  },
})
