import { internal } from "../_generated/api"
import { mutation, query, internalQuery } from "../_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "../_generated/dataModel"
import { v } from "convex/values"
import {
  subscribableObjectId,
  subscribableObjectType,
} from "@/convex/subscriptions/validators"

export const getSubscriptionRecord = internalQuery({
  args: {
    userId: v.id("users"),
    objectType: subscribableObjectType,
    objectId: subscribableObjectId,
  },
  returns: v.nullable(v.id("subscriptions")),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId_and_objectType_and_objectId", (q) =>
        q
          .eq("userId", args.userId)
          .eq("objectType", args.objectType)
          .eq("objectId", args.objectId)
      )
      .unique()
    return sub?._id || null
  },
})

export const getSubscription = query({
  args: {
    objectType: subscribableObjectType,
    objectId: subscribableObjectId,
  },
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return false
    }

    const subId: Id<"subscriptions"> | null = await ctx.runQuery(
      internal.subscriptions.index.getSubscriptionRecord,
      {
        userId,
        objectType: args.objectType,
        objectId: args.objectId,
      }
    )

    return subId !== null
  },
})

export const setSubscription = mutation({
  args: {
    objectType: subscribableObjectType,
    objectId: subscribableObjectId,
    subscribe: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return
    }

    const subId: Id<"subscriptions"> | null = await ctx.runQuery(
      internal.subscriptions.index.getSubscriptionRecord,
      {
        userId,
        objectType: args.objectType,
        objectId: args.objectId,
      }
    )

    if (!args.subscribe) {
      if (subId) await ctx.db.delete(subId)
      return
    }

    if (subId) return
    await ctx.db.insert("subscriptions", {
      userId,
      objectType: args.objectType,
      objectId: args.objectId,
    })
  },
})
