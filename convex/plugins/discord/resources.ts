"use node"

import { v } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { internal } from "@/convex/_generated/api"
import { action } from "@/convex/_generated/server"
import { upsertLinkedCompetitionResource } from "@/convex/plugins/core/linkCompetitionResource"
import { lookupDiscordChannel } from "@/convex/plugins/discord/api"

export const linkChannel = action({
  args: {
    competitionId: v.id("competitions"),
    channelId: v.string(),
  },
  returns: v.id("competitionLinkedResources"),
  handler: async (ctx, args): Promise<Id<"competitionLinkedResources">> => {
    await ctx.runQuery(
      internal.plugins.core.authorize.assertCompetitionUpdateAccess,
      { competitionId: args.competitionId }
    )
    const channel = await lookupDiscordChannel(args.channelId)
    return await upsertLinkedCompetitionResource(ctx, {
      competitionId: args.competitionId,
      resourceType: "discordChannel",
      data: {
        resourceType: "discordChannel",
        guildId: channel.guildId,
        channelId: channel.channelId,
        channelName: channel.channelName,
      },
    })
  },
})
