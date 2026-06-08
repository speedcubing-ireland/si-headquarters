import { env, mutation, query } from "@/convex/_generated/server"
import { requireDirector } from "@/convex/permissions/principal"
import {
  listAllApplicationTeamSummaries,
  listMemberIdsForTeam,
} from "@/convex/teams/model"
import { v } from "convex/values"

export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireDirector(ctx)
    const teams = await listAllApplicationTeamSummaries(ctx)
    const rows = []
    for (const team of teams) {
      const [channel, memberIds] = await Promise.all([
        ctx.db
          .query("teamDiscordChannels")
          .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
          .unique(),
        listMemberIdsForTeam(ctx, team._id),
      ])
      rows.push({
        teamId: team._id,
        teamName: team.name,
        memberCount: memberIds.length,
        channel:
          channel === null
            ? null
            : {
                channelId: channel.channelId,
                channelName: channel.channelName,
                guildId: channel.guildId,
                linkedAt: channel.linkedAt,
                linkedBy: channel.linkedBy,
              },
      })
    }
    return rows
  },
})

export const set = mutation({
  args: {
    teamId: v.id("teams"),
    channelId: v.string(),
    channelName: v.string(),
  },
  handler: async (ctx, args) => {
    const linkedBy = await requireDirector(ctx)
    const team = await ctx.db.get("teams", args.teamId)
    if (team === null) throw new Error("Team not found")

    const existing = await ctx.db
      .query("teamDiscordChannels")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .unique()
    const row = {
      teamId: args.teamId,
      guildId: env.DISCORD_GUILD_ID,
      channelId: args.channelId.trim(),
      channelName: args.channelName.trim(),
      linkedAt: Date.now(),
      linkedBy,
    }
    if (!row.channelId || !row.channelName) {
      throw new Error("Discord channel details are required")
    }
    if (existing === null) {
      await ctx.db.insert("teamDiscordChannels", row)
    } else {
      await ctx.db.patch("teamDiscordChannels", existing._id, row)
    }
    return null
  },
})

export const clear = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireDirector(ctx)
    const existing = await ctx.db
      .query("teamDiscordChannels")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .unique()
    if (existing !== null)
      await ctx.db.delete("teamDiscordChannels", existing._id)
    return null
  },
})
