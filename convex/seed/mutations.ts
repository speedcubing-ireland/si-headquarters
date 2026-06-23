import { mutation } from "@/convex/_generated/server"
import { createInitialUser, seedInitialData } from "@/convex/seed/model"
import { v } from "convex/values"

export const createUser = mutation({
  args: {
    wcaUserId: v.number(),
    name: v.string(),
    email: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    return await createInitialUser(ctx, args)
  },
})

export const run = mutation({
  args: {},
  returns: v.object({
    teamsEnsured: v.number(),
    labelsEnsured: v.number(),
    directorAssigned: v.boolean(),
    directorUserId: v.union(v.id("users"), v.null()),
  }),
  handler: async (ctx) => {
    return await seedInitialData(ctx)
  },
})
