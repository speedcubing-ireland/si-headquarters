"use node"

import { v } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { action } from "@/convex/_generated/server"
import { upsertLinkedObjectResource } from "@/convex/integrations/linkObjectResource"
import { competitionOrProjectRef } from "@/convex/utils"
import { lookupDiscordChannel } from "@/convex/plugins/discord/api"

export const linkChannel = action({
  args: {
    object: competitionOrProjectRef,
    channelId: v.string(),
  },
  returns: v.id("objectLinkedResources"),
  handler: async (ctx, args): Promise<Id<"objectLinkedResources">> => {
    const channel = await lookupDiscordChannel(args.channelId)
    return await upsertLinkedObjectResource(ctx, {
      object: args.object,
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
