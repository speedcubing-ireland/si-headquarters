import { v } from "convex/values"

const SUBSCRIBABLE_TABLE_NAMES = ["competitions", "users"] as const

export const subscribableObjectType = v.union(
  ...SUBSCRIBABLE_TABLE_NAMES.map((tableName) => v.literal(tableName))
)

export const subscribableObjectId = v.union(
  ...SUBSCRIBABLE_TABLE_NAMES.map((tableName) => v.id(tableName))
)

export const subscriptionsFields = v.union(
  ...SUBSCRIBABLE_TABLE_NAMES.map((tableName) =>
    v.object({
      userId: v.id("users"),
      objectType: v.literal(tableName),
      objectId: v.id(tableName),
    })
  )
)
