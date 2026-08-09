import { mutation, query } from "@/convex/_generated/server"
import { requireConvexEnv } from "@/convex/envTypes"
import { requireDirector } from "@/convex/permissions/principal"
import {
  listAllApplicationTeams,
  listMemberIdsForTeam,
} from "@/convex/teams/model"
import {
  resolveTeamSidebarPages,
  teamSidebarPages,
} from "@/convex/teams/validators"
import { v } from "convex/values"

export const listAdmin = query({
  args: {},
  returns: v.array(
    v.object({
      teamId: v.id("teams"),
      teamName: v.string(),
      memberCount: v.number(),
      sidebarPages: teamSidebarPages,
      channel: v.union(
        v.null(),
        v.object({
          channelId: v.string(),
          channelName: v.string(),
          guildId: v.string(),
          linkedAt: v.number(),
          linkedBy: v.id("users"),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    await requireDirector(ctx)
    const teams = await listAllApplicationTeams(ctx)
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
        sidebarPages: resolveTeamSidebarPages(team),
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const linkedBy = await requireDirector(ctx)
    const team = await ctx.db.get("teams", args.teamId)
    if (team === null) throw new Error("Team not found")

    const existing = await ctx.db
      .query("teamDiscordChannels")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .unique()
    const guildId = requireConvexEnv(
      "DISCORD_GUILD_ID",
      "Discord channel linking requires DISCORD_GUILD_ID to be set."
    )
    const row = {
      teamId: args.teamId,
      guildId,
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
  returns: v.null(),
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
