"use node"

import { internal } from "@/convex/_generated/api"
import { action } from "@/convex/_generated/server"
import { competitionOrProjectRef } from "@/convex/utils"
import { listGuildChannels } from "@/convex/plugins/discord/api"

export const listChannelsForObject = action({
  args: { object: competitionOrProjectRef },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.access.authorize.assertObjectUpdateAccess, {
      object: args.object,
    })
    return await listGuildChannels()
  },
})

export const listGuildChannelsForAdmin = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runQuery(internal.access.authorize.assertDirectorAccess, {})
    return await listGuildChannels()
  },
})
