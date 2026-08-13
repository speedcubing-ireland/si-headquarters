import { v } from "convex/values"
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "@/convex/_generated/server"
import { oauthService } from "@/convex/integrations/validators"
import { requireDirector } from "@/convex/permissions/principal"
import { OAUTH_PLUGINS } from "@/convex/plugins/oauthRegistry"

const storedTokenValidator = v.object({
  accessToken: v.string(),
  refreshToken: v.string(),
  expiresAt: v.number(),
  scope: v.optional(v.string()),
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
  scopes: v.array(v.string()),
  // false => `scopes` is what the plugin asks for, not what the provider
  // confirmed granting (older rows, and providers that omit `scope`).
  scopesGranted: v.boolean(),
  connectedBy: v.union(
    v.object({
      userId: v.id("users"),
      name: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
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
      scope: row.scope,
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
      scope: row.scope,
    }
  },
})

function splitScopes(scope: string): string[] {
  return scope.split(/\s+/).filter((entry) => entry.length > 0)
}

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
        const connectedByUserId = row?.connectedByUserId
        const connectedByUser =
          connectedByUserId === undefined
            ? null
            : await ctx.db.get("users", connectedByUserId)
        return {
          service: plugin.meta.service,
          displayName: plugin.client.displayName,
          providerArg: plugin.meta.cli.providerArg,
          connected: row !== null,
          // `saveToken` upserts with `patch`, so `_creationTime` never moves on
          // a reconnect — prefer the explicit field and only fall back for rows
          // written before it existed.
          connectedAt: row?.connectedAt ?? row?._creationTime ?? null,
          expiresAt: row?.expiresAt ?? null,
          hasRefreshToken: (row?.refreshToken ?? "") !== "",
          scopes: splitScopes(row?.scope ?? plugin.client.scope),
          scopesGranted: row?.scope !== undefined,
          connectedBy:
            connectedByUserId === undefined
              ? null
              : {
                  userId: connectedByUserId,
                  name: connectedByUser?.name ?? null,
                },
        }
      })
    )
  },
})

export const disconnectServiceAccount = mutation({
  args: { service: oauthService },
  returns: v.object({ disconnected: v.boolean() }),
  handler: async (ctx, args) => {
    await requireDirector(ctx)
    const row = await ctx.db
      .query("serviceTokens")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .unique()
    if (row === null) {
      return { disconnected: false }
    }
    await ctx.db.delete("serviceTokens", row._id)
    return { disconnected: true }
  },
})

export const saveToken = internalMutation({
  args: {
    service: oauthService,
    token: storedTokenValidator,
    // Absent for the `bun run auth` CLI, which has no signed-in user.
    connectedByUserId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("serviceTokens")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .unique()
    // Patching a field with `undefined` removes it, which is what we want on a
    // reconnect: a CLI reconnect must clear the previous director's attribution
    // rather than leave a stale one behind. Same for an absent `scope`.
    const row = {
      service: args.service,
      accessToken: args.token.accessToken,
      refreshToken: args.token.refreshToken,
      expiresAt: args.token.expiresAt,
      scope: args.token.scope,
      connectedByUserId: args.connectedByUserId,
      connectedAt: Date.now(),
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
          scope: existing.scope,
        },
      }
    }

    // A refresh is not a reconnect: patch only the token fields, leaving
    // `connectedByUserId` / `connectedAt` attribution intact. `scope` is only
    // written when the provider reported one, so a silent refresh cannot erase
    // a previously recorded grant.
    await ctx.db.patch("serviceTokens", existing._id, {
      accessToken: args.token.accessToken,
      refreshToken: args.token.refreshToken,
      expiresAt: args.token.expiresAt,
      ...(args.token.scope === undefined ? {} : { scope: args.token.scope }),
    })
    return { status: "saved" as const }
  },
})
