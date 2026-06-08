"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { action } from "@/convex/_generated/server"
import { listGuildChannels } from "@/convex/plugins/discord/api"

export const listChannels = action({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, args) => {
    await ctx.runQuery(
      internal.plugins.core.authorize.assertCompetitionUpdateAccess,
      { competitionId: args.competitionId }
    )
    return await listGuildChannels()
  },
})

export const listGuildChannelsForAdmin = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runQuery(internal.plugins.core.authorize.assertDirectorAccess, {})
    return await listGuildChannels()
  },
})
