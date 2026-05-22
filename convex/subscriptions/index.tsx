import { defineTable } from "convex/server"
import { internal } from "../_generated/api"
import { mutation, query, internalQuery } from "../_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "../_generated/dataModel"
import { v } from "convex/values"

const SUBSCRIBABLE_TABLES = [
  v.literal("competitions"),
  v.literal("users"),
] as const

export const SUBSCRIPTION_TABLE = defineTable(
  v.union(
    ...SUBSCRIBABLE_TABLES.map((tableName) =>
      v.object({
        userId: v.id("users"),
        objectType: v.literal(tableName.value),
        objectId: v.id(tableName.value),
      })
    )
  )
).index("by_userId_and_objectType_and_objectId", [
  "userId",
  "objectType",
  "objectId",
])

export const getSubscriptionRecord = internalQuery({
  args: {
    userId: v.id("users"),
    objectType: v.union(
      ...SUBSCRIBABLE_TABLES.map((table) => v.literal(table.value))
    ),
    objectId: v.union(...SUBSCRIBABLE_TABLES.map((table) => v.id(table.value))),
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
    objectType: v.union(
      ...SUBSCRIBABLE_TABLES.map((table) => v.literal(table.value))
    ),
    objectId: v.union(...SUBSCRIBABLE_TABLES.map((table) => v.id(table.value))),
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
    objectType: v.union(
      ...SUBSCRIBABLE_TABLES.map((table) => v.literal(table.value))
    ),
    objectId: v.union(...SUBSCRIBABLE_TABLES.map((table) => v.id(table.value))),
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
