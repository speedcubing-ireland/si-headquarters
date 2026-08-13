import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  action,
  internalMutation,
  mutation,
  query,
} from "@/convex/_generated/server"
import {
  consumeOAuthAttempt,
  createOAuthAttempt,
  invalidConnectionRequest,
  purgeExpiredOAuthAttempts,
} from "@/convex/integrations/serviceAccountAttempts"
import { SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH } from "@/convex/integrations/serviceAccountPaths"
import {
  oauthService,
  type OAuthService,
} from "@/convex/integrations/validators"
import { requireDirector } from "@/convex/permissions/principal"
import { generatePkcePair } from "@/convex/plugins/pkce"
import { oauthPluginForService } from "@/convex/plugins/oauthRegistry"
import type { OAuthPlugin } from "@/convex/plugins/oauthProvider"
import { loopbackAwareMainSiteUrl, resolveMainSiteBaseUrl } from "@/convex/urls"

const PURGE_BATCH_SIZE = 200

/**
 * The redirect URI for the browser flow. Derived from `SITE_URL`, the plugin's
 * own loopback hostname, and a compile-time path, never from a caller-supplied
 * value — the authorize request and the token exchange must agree, and accepting
 * one from the client would make this an open redirect.
 *
 * The per-plugin hostname only applies to local development, where Canva demands
 * `127.0.0.1` and the other two have `localhost` registered. The callback page
 * hops back to the `SITE_URL` origin so the exchange runs where the director is
 * signed in.
 *
 * This is separate from `plugin.redirectUri()`, which is the loopback URI the
 * `bun run auth` CLI serves on and must keep returning unchanged.
 */
function serviceAccountRedirectUri(plugin: OAuthPlugin): string {
  return loopbackAwareMainSiteUrl(
    SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH,
    plugin.meta.localhostRedirectHostname
  )
}

/**
 * The origin the callback page must run on — public because the page reads it
 * before the user is authenticated, when the provider sent the browser to a
 * different loopback host than `SITE_URL`. It is the site's own public origin,
 * so there is nothing to withhold.
 */
export const callbackSiteOrigin = query({
  args: {},
  returns: v.string(),
  handler: () => resolveMainSiteBaseUrl(),
})

export const startConnect = mutation({
  args: { service: oauthService },
  returns: v.object({ authorizeUrl: v.string() }),
  handler: async (ctx, args) => {
    const userId = await requireDirector(ctx)
    const plugin = oauthPluginForService(args.service)
    const pkce = plugin.usesPkce ? await generatePkcePair() : null
    const state = await createOAuthAttempt(ctx, {
      service: args.service,
      codeVerifier: pkce?.codeVerifier,
      userId,
    })
    return {
      authorizeUrl: plugin.buildAuthorizeUrl({
        redirectUri: serviceAccountRedirectUri(plugin),
        state,
        codeChallenge: pkce?.codeChallenge,
      }),
    }
  },
})

/**
 * Burns the attempt and reports who it belonged to. The director check lives
 * here rather than in `completeConnect` because auth identity propagates from an
 * action into `runMutation` — the same arrangement `refreshServiceAccount` uses
 * with `loadTokenForDirector`.
 */
export const consumeAttempt = internalMutation({
  args: { state: v.string() },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      service: oauthService,
      codeVerifier: v.optional(v.string()),
      userId: v.id("users"),
    }),
    v.object({ status: v.literal("invalid") })
  ),
  handler: async (ctx, args) => {
    const userId = await requireDirector(ctx)
    const attempt = await consumeOAuthAttempt(ctx, {
      state: args.state,
      userId,
    })
    return attempt.status === "invalid" ? attempt : { ...attempt, userId }
  },
})

export const completeConnect = action({
  // No `service` argument: it comes from the attempt row, which is the
  // authoritative binding for this state.
  args: { state: v.string(), code: v.string() },
  returns: v.union(
    v.object({
      success: v.literal(true),
      service: oauthService,
      displayName: v.string(),
      expiresAt: v.number(),
    }),
    v.object({ success: v.literal(false), message: v.string() })
  ),
  handler: async (ctx, args) => {
    const attempt:
      | {
          status: "ok"
          service: OAuthService
          codeVerifier?: string
          userId: Id<"users">
        }
      | { status: "invalid" } = await ctx.runMutation(
      internal.integrations.serviceAccountConnect.consumeAttempt,
      { state: args.state }
    )
    if (attempt.status === "invalid") {
      // Thrown here rather than inside the mutation so the attempt stays
      // deleted. The callback page surfaces this message as-is.
      invalidConnectionRequest()
    }
    const plugin = oauthPluginForService(attempt.service)

    try {
      const token = await plugin.exchangeCode({
        code: args.code,
        redirectUri: serviceAccountRedirectUri(plugin),
        codeVerifier: attempt.codeVerifier,
      })
      await ctx.runMutation(internal.integrations.tokensStore.saveToken, {
        service: plugin.meta.service,
        token,
        connectedByUserId: attempt.userId,
      })
      return {
        success: true as const,
        service: plugin.meta.service,
        displayName: plugin.client.displayName,
        expiresAt: token.expiresAt,
      }
    } catch (error) {
      return {
        success: false as const,
        message:
          error instanceof Error
            ? error.message
            : `Could not connect ${plugin.client.displayName}.`,
      }
    }
  },
})

export const purgeExpiredAttempts = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) =>
    await purgeExpiredOAuthAttempts(ctx, PURGE_BATCH_SIZE),
})
