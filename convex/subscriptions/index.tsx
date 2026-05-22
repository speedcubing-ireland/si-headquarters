import { internal } from "../_generated/api"
import { mutation, query, internalQuery } from "../_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "../_generated/dataModel"
import { v } from "convex/values"
import { subscribableObjectRef } from "@/convex/subscriptions/validators"

export const getSubscriptionRecord = internalQuery({
  args: {
    userId: v.id("users"),
    object: subscribableObjectRef,
  },
  returns: v.nullable(v.id("subscriptions")),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId_and_object_type_and_object_id", (q) =>
        q
          .eq("userId", args.userId)
          .eq("object.type", args.object.type)
          .eq("object.id", args.object.id)
      )
      .unique()
    return sub?._id || null
  },
})

export const getSubscription = query({
  args: {
    object: subscribableObjectRef,
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
        object: args.object,
      }
    )

    return subId !== null
  },
})

export const setSubscription = mutation({
  args: {
    object: subscribableObjectRef,
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
        object: args.object,
      }
    )

    if (!args.subscribe) {
      if (subId) await ctx.db.delete(subId)
      return
    }

    if (subId) return
    await ctx.db.insert("subscriptions", {
      userId,
      object: args.object,
    })
  },
})
