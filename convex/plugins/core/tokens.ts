"use node"

import { ConvexError, v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction } from "@/convex/_generated/server"
import { oauthService } from "@/convex/plugins/core/validators"
import { oauthPluginForService } from "@/convex/plugins/oauthRegistry"

const EXPIRY_BUFFER_SEC = 120

export const getValidServiceToken = internalAction({
  args: { service: oauthService },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const oauth = oauthPluginForService(args.service)

    const stored = await ctx.runQuery(internal.plugins.core.tokensStore.loadToken, {
      service: args.service,
    })
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
    await ctx.runMutation(internal.plugins.core.tokensStore.saveToken, {
      service: args.service,
      token,
    })
    return token.accessToken
  },
})
