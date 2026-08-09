import { v, type Infer } from "convex/values"

export const TEAM_SIDEBAR_PAGES = ["tasks", "projects"] as const

export const teamSidebarPage = v.union(
  v.literal("tasks"),
  v.literal("projects")
)
export type TeamSidebarPage = Infer<typeof teamSidebarPage>

export const teamSidebarPages = v.object({
  tasks: v.boolean(),
  projects: v.boolean(),
})
export type TeamSidebarPages = Infer<typeof teamSidebarPages>

export const teamsFields = {
  name: v.string(),
  disabledSidebarPages: v.optional(v.array(teamSidebarPage)),
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

export const teamNavigationSummary = v.object({
  _id: v.id("teams"),
  name: v.string(),
  sidebarPages: teamSidebarPages,
})

export function resolveTeamSidebarPages(team: {
  disabledSidebarPages?: TeamSidebarPage[]
}): TeamSidebarPages {
  const disabledPages = new Set(team.disabledSidebarPages ?? [])
  return {
    tasks: !disabledPages.has("tasks"),
    projects: !disabledPages.has("projects"),
  }
}

export function isTeamSidebarPageEnabled(
  team: { disabledSidebarPages?: TeamSidebarPage[] },
  page: TeamSidebarPage
): boolean {
  return !(team.disabledSidebarPages ?? []).includes(page)
}
