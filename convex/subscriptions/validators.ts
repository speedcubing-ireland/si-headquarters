import { v } from "convex/values"

export const subscribableObjectRef = v.union(
  ...(["competitions", "users"] as const).map((tableName) =>
    v.object({
      type: v.literal(tableName),
      id: v.id(tableName),
    })
  )
)

export const subscriptionsFields = {
  userId: v.id("users"),
  object: subscribableObjectRef,
}
