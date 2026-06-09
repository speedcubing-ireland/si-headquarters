import { v, type Infer } from "convex/values"

export const teamsFields = {
  name: v.string(),
}

export const teamMembershipFields = {
  teamId: v.id("teams"),
  userId: v.id("users"),
}

export const teamDiscordChannelFields = {
  teamId: v.id("teams"),
  guildId: v.string(),
  channelId: v.string(),
  channelName: v.string(),
  linkedAt: v.number(),
  linkedBy: v.id("users"),
}

export const teamSummary = v.object({
  _id: v.id("teams"),
  name: v.string(),
})
export type TeamSummary = Infer<typeof teamSummary>
