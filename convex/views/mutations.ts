import type { Id } from "@/convex/_generated/dataModel"
import { mutation, type MutationCtx } from "@/convex/_generated/server"
import { requireUserId } from "@/convex/lib/requireUser"
import {
  viewEntity,
  viewVisibility,
} from "@/convex/views/validators"
import { v } from "convex/values"

async function requireViewOwner(ctx: MutationCtx, viewId: Id<"savedViews">) {
  const userId = await requireUserId(ctx)
  const doc = await ctx.db.get("savedViews", viewId)
  if (!doc) {
    throw new Error("View not found")
  }
  if (doc.ownerId !== userId) {
    throw new Error("Not authorized to modify this view")
  }
  return { userId, doc }
}

export const createView = mutation({
  args: {
    entity: viewEntity,
    pageId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    visibility: viewVisibility,
    filtersJson: v.string(),
    displaySettingsJson: v.string(),
  },
  returns: v.id("savedViews"),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx)
    const now = Date.now()
    const name = args.name.trim()
    if (name.length === 0) {
      throw new Error("View name is required")
    }

    const description = args.description?.trim()
    const normalizedDescription =
      description !== undefined && description.length > 0
        ? description
        : null

    return await ctx.db.insert("savedViews", {
      ownerId,
      visibility: args.visibility,
      entity: args.entity,
      pageId: args.pageId,
      name,
      description: normalizedDescription,
      filtersJson: args.filtersJson,
      displaySettingsJson: args.displaySettingsJson,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
    })
  },
})

export const updateView = mutation({
  args: {
    id: v.id("savedViews"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    filtersJson: v.optional(v.string()),
    displaySettingsJson: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireViewOwner(ctx, args.id)

    const { id, name, description, filtersJson, displaySettingsJson } = args
    const patch: {
      name?: string
      description?: string | null
      filtersJson?: string
      displaySettingsJson?: string
      updatedAt: number
    } = {
      updatedAt: Date.now(),
    }

    if (name !== undefined) {
      const trimmed = name.trim()
      if (trimmed.length === 0) {
        throw new Error("View name is required")
      }
      patch.name = trimmed
    }

    if (description !== undefined) {
      const trimmed = description?.trim()
      patch.description =
        trimmed !== undefined && trimmed.length > 0 ? trimmed : null
    }

    if (filtersJson !== undefined) {
      patch.filtersJson = filtersJson
    }

    if (displaySettingsJson !== undefined) {
      patch.displaySettingsJson = displaySettingsJson
    }

    await ctx.db.patch("savedViews", id, patch)
    return null
  },
})

export const deleteView = mutation({
  args: {
    id: v.id("savedViews"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireViewOwner(ctx, args.id)
    await ctx.db.delete("savedViews", args.id)
    return null
  },
})

export const touchView = mutation({
  args: {
    id: v.id("savedViews"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const doc = await ctx.db.get("savedViews", args.id)
    if (!doc) {
      return null
    }

    const canTouch =
      doc.ownerId === userId || doc.visibility === "public"
    if (!canTouch) {
      throw new Error("Not authorized to use this view")
    }

    await ctx.db.patch("savedViews", args.id, {
      lastUsedAt: Date.now(),
    })
    return null
  },
})
