import { mutation, query, internalQuery } from "../_generated/server"
import { getPrincipalOrNull } from "@/convex/permissions/principal"
import type { Id, Doc } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { v } from "convex/values"
import { subscribableObjectRef } from "@/convex/subscriptions/validators"
import { requireScopedObjectForRead } from "@/convex/access/scopedObject"
import { requireTaskReadAccess } from "@/convex/tasks/access"

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

async function requireSubscribableReadAccess(
  ctx: QueryCtx | MutationCtx,
  object: Doc<"subscriptions">["object"]
) {
  if (object.type === "competitions" || object.type === "projects") {
    await requireScopedObjectForRead(ctx, object)
    return
  }
  await requireTaskReadAccess(ctx, object.id)
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
    const principal = await getPrincipalOrNull(ctx)
    if (principal === null) {
      return false
    }
    await requireSubscribableReadAccess(ctx, args.object)
    const userId = principal.userId

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
    const principal = await getPrincipalOrNull(ctx)
    if (principal === null) {
      return
    }
    await requireSubscribableReadAccess(ctx, args.object)
    const userId = principal.userId

    const subId = await getSubscriptionRecordId(ctx, userId, args.object)

    if (!args.subscribe) {
      if (subId) await ctx.db.delete("subscriptions", subId)
      return
    }

    if (subId) return
    await ctx.db.insert("subscriptions", {
      userId,
      object: args.object,
    })
  },
})
