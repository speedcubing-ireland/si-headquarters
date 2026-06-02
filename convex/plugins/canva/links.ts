"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { action, type ActionCtx } from "@/convex/_generated/server"
import type { Id } from "@/convex/_generated/dataModel"
import {
  buildCanvaDesignEditUrl,
  fetchCanvaDesignMetadata,
  parseCanvaDesignUrl,
} from "@/convex/plugins/canva/helpers"

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
  await ctx.runQuery(internal.plugins.core.authorize.assertTaskIntegrationAccess, {
    integrationRowId: args.id,
  })

  const parsed = parseCanvaDesignUrl(args.designUrl)
  const accessToken = await ctx.runAction(
    internal.plugins.core.tokens.getValidServiceToken,
    { service: "canva" }
  )
  const metadata = await fetchCanvaDesignMetadata(accessToken, parsed.designId)
  return {
    designId: parsed.designId,
    designUrl: buildCanvaDesignEditUrl(parsed.designId),
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

    await ctx.runMutation(internal.plugins.canva.mutations.applyLinkedCanvaDesign, {
      integrationRowId: args.id,
      designId: design.designId,
      designUrl: design.designUrl,
      thumbnailUrl: design.thumbnailUrl,
      title: design.title,
    })
    return null
  },
})
