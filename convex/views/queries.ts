import { query } from "@/convex/_generated/server"
import { requireActiveUserId } from "@/convex/permissions/principal"
import {
  savedViewListItem,
  viewEntity,
} from "@/convex/views/validators"
import { v } from "convex/values"

export const listViews = query({
  args: {
    entity: viewEntity,
    pageId: v.string(),
  },
  returns: v.array(savedViewListItem),
  handler: async (ctx, args) => {
    const userId = await requireActiveUserId(ctx)

    const [privateViews, publicViews] = await Promise.all([
      ctx.db
        .query("savedViews")
        .withIndex("by_owner_entity_page", (q) =>
          q
            .eq("ownerId", userId)
            .eq("entity", args.entity)
            .eq("pageId", args.pageId)
        )
        .order("desc")
        .collect(),
      ctx.db
        .query("savedViews")
        .withIndex("by_visibility_entity_page", (q) =>
          q
            .eq("visibility", "public")
            .eq("entity", args.entity)
            .eq("pageId", args.pageId)
        )
        .order("asc")
        .collect(),
    ])

    const privateItems = privateViews
      .filter((view) => view.visibility === "private")
      .map((view) => ({
        _id: view._id,
        ownerId: view.ownerId,
        visibility: view.visibility,
        name: view.name,
        description: view.description,
        filtersJson: view.filtersJson,
        displaySettingsJson: view.displaySettingsJson,
        lastUsedAt: view.lastUsedAt,
      }))

    const publicItems = publicViews.map((view) => ({
      _id: view._id,
      ownerId: view.ownerId,
      visibility: view.visibility,
      name: view.name,
      description: view.description,
      filtersJson: view.filtersJson,
      displaySettingsJson: view.displaySettingsJson,
      lastUsedAt: view.lastUsedAt,
    }))

    publicItems.sort((a, b) => a.name.localeCompare(b.name))
    privateItems.sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))

    return [...publicItems, ...privateItems]
  },
})
