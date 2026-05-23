import { mutation, query, internalQuery } from "../_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id, Doc } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { v } from "convex/values"
import { subscribableObjectRef } from "@/convex/subscriptions/validators"

async function getSubscriptionRecordId(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  object: Doc<"subscriptions">["object"]
) {
  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId_and_object_type_and_object_id", (q) =>
      q
        .eq("userId", userId)
        .eq("object.type", object.type)
        .eq("object.id", object.id)
    )
    .unique()

  return sub?._id ?? null
}

export const getSubscriptionRecord = internalQuery({
  args: {
    userId: v.id("users"),
    object: subscribableObjectRef,
  },
  handler: async (ctx, args) => {
    return await getSubscriptionRecordId(ctx, args.userId, args.object)
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

    const subId = await getSubscriptionRecordId(ctx, userId, args.object)

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

    const subId = await getSubscriptionRecordId(ctx, userId, args.object)

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
