import { v } from "convex/values"

export const viewEntity = v.literal("tasks")

export const viewVisibility = v.union(
  v.literal("private"),
  v.literal("public")
)

export const savedViewFields = {
  ownerId: v.id("users"),
  visibility: viewVisibility,
  entity: viewEntity,
  pageId: v.string(),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  filtersJson: v.string(),
  displaySettingsJson: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  lastUsedAt: v.union(v.number(), v.null()),
}

export const savedViewListItem = v.object({
  _id: v.id("savedViews"),
  ownerId: v.id("users"),
  visibility: viewVisibility,
  name: v.string(),
  description: v.union(v.string(), v.null()),
  filtersJson: v.string(),
  displaySettingsJson: v.string(),
  lastUsedAt: v.union(v.number(), v.null()),
})
