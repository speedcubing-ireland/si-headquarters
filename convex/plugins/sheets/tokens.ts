"use node"

import type { ActionCtx } from "@/convex/_generated/server"
import { resolveValidServiceToken } from "@/convex/integrations/tokens"

export async function fetchGoogleAndWcaTokens(ctx: ActionCtx) {
  const [googleAccessToken, wcaAccessToken] = await Promise.all([
    resolveValidServiceToken(ctx, "google"),
    resolveValidServiceToken(ctx, "wca"),
  ])
  return { googleAccessToken, wcaAccessToken }
}
