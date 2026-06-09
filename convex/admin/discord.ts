"use node"

import { action } from "@/convex/_generated/server"
import { api } from "@/convex/_generated/api"
import { v } from "convex/values"
import {
  discordLinkValidator,
  type DiscordLink,
} from "@/convex/users/validators"

export const searchGuildMembersForUserManagement = action({
  args: {
    query: v.string(),
  },
  returns: v.array(discordLinkValidator),
  handler: async (ctx, args): Promise<DiscordLink[]> => {
    return await ctx.runAction(
      api.plugins.discord.actions.searchGuildMembersForUserManagement,
      args
    )
  },
})
