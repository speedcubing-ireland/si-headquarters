"use node"

import { ConvexError, v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction, type ActionCtx } from "@/convex/_generated/server"
import {
  oauthService,
  type OAuthService,
} from "@/convex/integrations/validators"
import { oauthPluginForService } from "@/convex/plugins/oauthRegistry"

const EXPIRY_BUFFER_SEC = 120

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

  const refreshed = await oauth.refreshToken(stored.refreshToken)
  const token = {
    accessToken: refreshed.accessToken,
    refreshToken:
      refreshed.refreshToken !== ""
        ? refreshed.refreshToken
        : stored.refreshToken,
    expiresAt: refreshed.expiresAt,
  }
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
