"use node"

import { v } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { resolveValidServiceToken } from "@/convex/integrations/tokens"
import { action } from "@/convex/_generated/server"
import { upsertLinkedObjectResource } from "@/convex/integrations/linkObjectResource"
import { competitionOrProjectRef } from "@/convex/utils"
import { fetchSpreadsheetTitle } from "@/convex/plugins/sheets/googleApi"

export const linkSheet = action({
  args: {
    object: competitionOrProjectRef,
    sheetId: v.string(),
  },
  returns: v.id("objectLinkedResources"),
  handler: async (ctx, args): Promise<Id<"objectLinkedResources">> => {
    const accessToken = await resolveValidServiceToken(ctx, "google")
    const trimmed = args.sheetId.trim()
    const sheetId =
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed)?.[1] ?? trimmed
    const { title, url } = await fetchSpreadsheetTitle(accessToken, sheetId)
    return await upsertLinkedObjectResource(ctx, {
      object: args.object,
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
