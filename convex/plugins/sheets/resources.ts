"use node"

import { v } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { internal } from "@/convex/_generated/api"
import { action } from "@/convex/_generated/server"
import { upsertLinkedCompetitionResource } from "@/convex/plugins/core/linkCompetitionResource"
import { fetchSpreadsheetTitle } from "@/convex/plugins/sheets/googleApi"

export const linkSheet = action({
  args: {
    competitionId: v.id("competitions"),
    sheetId: v.string(),
  },
  returns: v.id("competitionLinkedResources"),
  handler: async (ctx, args): Promise<Id<"competitionLinkedResources">> => {
    await ctx.runQuery(
      internal.plugins.core.authorize.assertCompetitionUpdateAccess,
      { competitionId: args.competitionId }
    )
    const accessToken = await ctx.runAction(
      internal.plugins.core.tokens.getValidServiceToken,
      { service: "google" }
    )
    const sheetId = args.sheetId.trim()
    const { title, url } = await fetchSpreadsheetTitle(accessToken, sheetId)
    return await upsertLinkedCompetitionResource(ctx, {
      competitionId: args.competitionId,
      resourceType: "googleSheet",
      data: {
        resourceType: "googleSheet",
        sheetId,
        title,
        url,
      },
    })
  },
})
