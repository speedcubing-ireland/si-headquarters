"use node"

import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError, v } from "convex/values"
import type { ActionCtx } from "@/convex/_generated/server"
import { internal } from "@/convex/_generated/api"
import { action } from "@/convex/_generated/server"
import {
  fetchMyCompetitionOptions,
  searchCompetitionOptions,
  wcaCompetitionOption,
} from "@/convex/plugins/wca/competitionOptions"
import { assertWcaIntegrationEnabled } from "@/convex/plugins/sponsor/lib/wcaIntegration"

async function assertSponsorManagerAccess(ctx: ActionCtx): Promise<void> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Sponsorship manager access is required.",
    })
  }
  const isManager = await ctx.runQuery(
    internal.permissions.queries.canAccessSponsorPortalAdminForUserId,
    { userId }
  )
  if (!isManager) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Sponsorship manager access is required.",
    })
  }
}

async function getWcaServiceAccessToken(ctx: ActionCtx): Promise<string> {
  return ctx.runAction(internal.integrations.tokens.getValidServiceToken, {
    service: "wca",
  })
}

/**
 * List WCA competitions delegated to the HQ service account. Same data source as
 * convex/plugins/wca/resources.ts:listMyCompetitions, authorized for
 * sponsorship managers.
 */
export const listMyWcaCompetitions = action({
  args: {},
  returns: v.array(wcaCompetitionOption),
  handler: async (ctx) => {
    assertWcaIntegrationEnabled()
    await assertSponsorManagerAccess(ctx)
    const accessToken = await getWcaServiceAccessToken(ctx)
    return fetchMyCompetitionOptions(accessToken)
  },
})

/**
 * Search WCA competitions for the sponsorship admin auction-create flow. Uses
 * the HQ service account like convex/plugins/wca/resources.ts:searchCompetitions.
 */
export const searchWcaCompetitions = action({
  args: { query: v.string() },
  returns: v.array(wcaCompetitionOption),
  handler: async (ctx, args) => {
    assertWcaIntegrationEnabled()
    await assertSponsorManagerAccess(ctx)
    const accessToken = await getWcaServiceAccessToken(ctx)
    try {
      return await searchCompetitionOptions(accessToken, args.query)
    } catch {
      throw new ConvexError({
        code: "BAD_GATEWAY",
        message: "WCA competition search failed. Try again in a moment.",
      })
    }
  },
})
