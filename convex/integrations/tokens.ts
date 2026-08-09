"use node"

import { ConvexError, v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import {
  action,
  internalAction,
  type ActionCtx,
} from "@/convex/_generated/server"
import {
  oauthService,
  type OAuthService,
} from "@/convex/integrations/validators"
import { oauthPluginForService } from "@/convex/plugins/oauthRegistry"
import type { StoredServiceToken } from "@/convex/plugins/oauthProvider"

const EXPIRY_BUFFER_SEC = 120

async function refreshStoredServiceToken(
  service: OAuthService,
  stored: StoredServiceToken
): Promise<StoredServiceToken> {
  const oauth = oauthPluginForService(service)
  const refreshed = await oauth.refreshToken(stored.refreshToken)
  return {
    accessToken: refreshed.accessToken,
    refreshToken:
      refreshed.refreshToken !== ""
        ? refreshed.refreshToken
        : stored.refreshToken,
    expiresAt: refreshed.expiresAt,
  }
}

export async function resolveValidServiceToken(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  service: OAuthService
): Promise<string> {
  const oauth = oauthPluginForService(service)

  const stored = await ctx.runQuery(
    internal.integrations.tokensStore.loadToken,
    {
      service,
    }
  )
  if (stored === null) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: `${oauth.client.displayName} is not connected. Run 'bun run auth ${oauth.meta.cli.providerArg}'.`,
    })
  }

  const nowSec = Math.floor(Date.now() / 1000)
  if (stored.expiresAt > nowSec + EXPIRY_BUFFER_SEC) {
    return stored.accessToken
  }

  if (stored.refreshToken === "") {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: `${oauth.client.displayName} token expired and cannot be refreshed.`,
    })
  }

  const token = await refreshStoredServiceToken(service, stored)
  await ctx.runMutation(internal.integrations.tokensStore.saveToken, {
    service,
    token,
  })
  return token.accessToken
}

export const getValidServiceToken = internalAction({
  args: { service: oauthService },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    return await resolveValidServiceToken(ctx, args.service)
  },
})

export const refreshServiceAccount = action({
  args: { service: oauthService },
  returns: v.union(
    v.object({ success: v.literal(true), expiresAt: v.number() }),
    v.object({ success: v.literal(false), message: v.string() })
  ),
  handler: async (ctx, args) => {
    const stored = await ctx.runQuery(
      internal.integrations.tokensStore.loadTokenForDirector,
      { service: args.service }
    )
    const oauth = oauthPluginForService(args.service)
    if (stored === null) {
      return {
        success: false as const,
        message: `${oauth.client.displayName} is not connected.`,
      }
    }
    if (stored.refreshToken === "") {
      return {
        success: false as const,
        message: `${oauth.client.displayName} does not have a refresh token. Reconnect it from the CLI.`,
      }
    }

    try {
      const token = await refreshStoredServiceToken(args.service, stored)
      await ctx.runMutation(internal.integrations.tokensStore.saveToken, {
        service: args.service,
        token,
      })
      return { success: true as const, expiresAt: token.expiresAt }
    } catch (error) {
      return {
        success: false as const,
        message:
          error instanceof Error
            ? error.message
            : `Could not refresh ${oauth.client.displayName}.`,
      }
    }
  },
})
