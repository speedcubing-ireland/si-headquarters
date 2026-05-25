import { v } from "convex/values"
import { objectRef } from "@/convex/utils"

export const subscribableObjectRef = v.union(
  objectRef("competitions"),
  objectRef("tasks")
)

export const subscriptionsFields = {
  userId: v.id("users"),
  object: subscribableObjectRef,
}
