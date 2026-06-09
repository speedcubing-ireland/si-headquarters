import { mutation } from "@/convex/_generated/server"
import { seedInitialData } from "@/convex/seed/model"
import { v } from "convex/values"

/** Idempotent bootstrap for teams, task labels, and the sole initial director. */
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
