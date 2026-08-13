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
const CONCURRENT_REFRESH_RETRY_DELAYS_MS = [0, 50, 150] as const

type TokenStoreContext = Pick<ActionCtx, "runQuery" | "runMutation">

function isUsableServiceToken(token: StoredServiceToken): boolean {
  const nowSec = Math.floor(Date.now() / 1000)
  return token.expiresAt > nowSec + EXPIRY_BUFFER_SEC
}

function tokenChanged(
  stored: StoredServiceToken,
  candidate: StoredServiceToken
): boolean {
  return (
    candidate.accessToken !== stored.accessToken ||
    candidate.refreshToken !== stored.refreshToken ||
    candidate.expiresAt !== stored.expiresAt
  )
}

async function waitForConcurrentRefresh(
  ctx: TokenStoreContext,
  service: OAuthService,
  attemptedToken: StoredServiceToken
): Promise<StoredServiceToken | null> {
  for (const delayMs of CONCURRENT_REFRESH_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
    }
    const latest = await ctx.runQuery(
      internal.integrations.tokensStore.loadToken,
      { service }
    )
    if (
      latest !== null &&
      tokenChanged(attemptedToken, latest) &&
      isUsableServiceToken(latest)
    ) {
      return latest
    }
  }
  return null
}

async function refreshStoredServiceToken(
  ctx: TokenStoreContext,
  service: OAuthService,
  stored: StoredServiceToken
): Promise<StoredServiceToken> {
  const oauth = oauthPluginForService(service)
  let refreshed: StoredServiceToken
  try {
    refreshed = await oauth.refreshToken(stored.refreshToken)
  } catch (error) {
    const concurrentToken = await waitForConcurrentRefresh(ctx, service, stored)
    if (concurrentToken !== null) {
      return concurrentToken
    }
    throw error
  }

  const token = {
    accessToken: refreshed.accessToken,
    refreshToken:
      refreshed.refreshToken !== ""
        ? refreshed.refreshToken
        : stored.refreshToken,
    expiresAt: refreshed.expiresAt,
    // A refresh response that omits `scope` means "unchanged", not "nothing
    // granted", so keep whatever was recorded at connect time.
    scope: refreshed.scope ?? stored.scope,
  }
  const saveResult = await ctx.runMutation(
    internal.integrations.tokensStore.saveRefreshedToken,
    {
      service,
      expectedToken: stored,
      token,
    }
  )
  if (saveResult.status === "saved") {
    return token
  }
  if (
    saveResult.status === "superseded" &&
    isUsableServiceToken(saveResult.token)
  ) {
    return saveResult.token
  }
  throw new Error(
    `${oauth.client.displayName} connection changed while its token was being refreshed. Try again.`
  )
}

export async function resolveValidServiceToken(
  ctx: TokenStoreContext,
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
      message: `${oauth.client.displayName} is not connected. Connect it from Admin → Service accounts.`,
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

  const token = await refreshStoredServiceToken(ctx, service, stored)
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
        message: `${oauth.client.displayName} does not have a refresh token. Reconnect it from Admin → Service accounts.`,
      }
    }

    try {
      const token = await refreshStoredServiceToken(ctx, args.service, stored)
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
