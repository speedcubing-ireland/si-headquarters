"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { action, type ActionCtx } from "@/convex/_generated/server"
import type { Id } from "@/convex/_generated/dataModel"
import { resolveValidServiceToken } from "@/convex/integrations/tokens"
import {
  fetchCanvaDesignMetadata,
  fetchCanvaThumbnailUrl,
  parseCanvaDesignUrl,
} from "@/convex/plugins/canva/helpers"

const THUMBNAIL_REFRESH_AFTER_MS = 14 * 60 * 1000

const canvaDesignCandidate = v.object({
  designId: v.string(),
  designUrl: v.string(),
  title: v.string(),
  thumbnailUrl: v.optional(v.string()),
})

async function validateDesignCandidate(
  ctx: ActionCtx,
  args: {
    id: Id<"taskIntegrations">
    designUrl: string
  }
) {
  await ctx.runQuery(internal.access.authorize.assertTaskIntegrationAccess, {
    integrationRowId: args.id,
  })

  const parsed = parseCanvaDesignUrl(args.designUrl)
  const accessToken = await resolveValidServiceToken(ctx, "canva")
  const metadata = await fetchCanvaDesignMetadata(accessToken, parsed.designId)
  return {
    designId: parsed.designId,
    designUrl: parsed.designUrl,
    title: metadata.title,
    thumbnailUrl: metadata.thumbnailUrl,
  }
}

export const validateDesign = action({
  args: {
    id: v.id("taskIntegrations"),
    designUrl: v.string(),
  },
  returns: canvaDesignCandidate,
  handler: async (ctx, args) => {
    return await validateDesignCandidate(ctx, args)
  },
})

export const linkDesign = action({
  args: {
    id: v.id("taskIntegrations"),
    designUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const design = await validateDesignCandidate(ctx, args)

    await ctx.runMutation(
      internal.plugins.canva.mutations.applyLinkedCanvaDesign,
      {
        integrationRowId: args.id,
        designId: design.designId,
        designUrl: design.designUrl,
      }
    )
    return null
  },
})

export const refreshThumbnail = action({
  args: { id: v.id("taskIntegrations") },
  returns: v.union(
    v.object({
      success: v.literal(true),
      thumbnailUrl: v.string(),
      refreshAfterMs: v.number(),
    }),
    v.object({ success: v.literal(false), message: v.string() })
  ),
  handler: async (ctx, args) => {
    const design = await ctx.runQuery(
      internal.plugins.canva.mutations.loadDesignForThumbnailRefresh,
      { integrationRowId: args.id }
    )
    if (design === null) {
      return {
        success: false as const,
        message: "This integration does not have a Canva design to preview.",
      }
    }

    const accessToken = await resolveValidServiceToken(ctx, "canva")
    const thumbnailUrl = await fetchCanvaThumbnailUrl(
      accessToken,
      design.designId
    )
    if (thumbnailUrl === undefined) {
      return {
        success: false as const,
        message: "Canva did not provide a thumbnail.",
      }
    }
    return {
      success: true as const,
      thumbnailUrl,
      refreshAfterMs: THUMBNAIL_REFRESH_AFTER_MS,
    }
  },
})
