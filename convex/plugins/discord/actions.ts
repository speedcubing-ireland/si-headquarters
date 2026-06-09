"use node"

import { action } from "@/convex/_generated/server"
import { internal } from "@/convex/_generated/api"
import { v } from "convex/values"
import { searchGuildMembers } from "@/convex/plugins/discord/members"
import { discordLinkValidator } from "@/convex/users/validators"

export const searchGuildMembersForUserManagement = action({
  args: {
    query: v.string(),
  },
  returns: v.array(discordLinkValidator),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.permissions.queries.assertUserManagement, {})
    const query = args.query.trim()
    if (query.length < 2) {
      return []
    }
    return await searchGuildMembers(query)
  },
})
