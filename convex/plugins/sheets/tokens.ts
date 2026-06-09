"use node"

import { internal } from "@/convex/_generated/api"
import type { ActionCtx } from "@/convex/_generated/server"

export async function fetchGoogleAndWcaTokens(ctx: ActionCtx) {
  const [googleAccessToken, wcaAccessToken] = await Promise.all([
    ctx.runAction(internal.integrations.tokens.getValidServiceToken, {
      service: "google",
    }),
    ctx.runAction(internal.integrations.tokens.getValidServiceToken, {
      service: "wca",
    }),
  ])
  return { googleAccessToken, wcaAccessToken }
}
