import { query } from "@/convex/_generated/server"
import { collectAll } from "@/convex/utils"
import {
  requireCan,
  requirePrincipal,
  requireUserManagement,
} from "@/convex/permissions/principal"
import {
  isApplicationTeam,
  listMemberIdsForTeam,
  listAllApplicationTeamSummaries,
  listApplicationTeamsForUser,
  toTeamSummary,
  userCanAccessTeam,
} from "@/convex/teams/model"
import {
  isTeamSidebarPageEnabled,
  resolveTeamSidebarPages,
  teamNavigationSummary,
  teamSidebarPage,
  teamSummary,
} from "@/convex/teams/validators"
import { v } from "convex/values"

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      _creationTime: v.number(),
      name: v.string(),
      memberIds: v.array(v.id("users")),
    })
  ),
  handler: async (ctx) => {
    const principal = await requirePrincipal(ctx)
    requireCan(principal, "read", "Team")
    const teams = await collectAll(ctx, "teams")
    return await Promise.all(
      teams.map(async (team) => ({
        _id: team._id,
        _creationTime: team._creationTime,
        name: team.name,
        memberIds: await listMemberIdsForTeam(ctx, team._id),
      }))
    )
  },
})

export const listForNavigation = query({
  args: {},
  returns: v.array(teamNavigationSummary),
  handler: async (ctx) => {
    const principal = await requirePrincipal(ctx)
    const teams = await listApplicationTeamsForUser(ctx, principal.userId)
    return teams.map((team) => ({
      ...toTeamSummary(team),
      sidebarPages: resolveTeamSidebarPages(team),
    }))
  },
})

export const listForTaskFilters = query({
  args: {},
  returns: v.array(teamSummary),
  handler: async (ctx) => {
    const principal = await requirePrincipal(ctx)
    requireCan(principal, "read", "Team")
    return await listAllApplicationTeamSummaries(ctx)
  },
})

export const getForPage = query({
  args: {
    teamId: v.id("teams"),
    page: teamSidebarPage,
  },
  returns: v.union(teamSummary, v.null()),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const team = await ctx.db.get("teams", args.teamId)
    if (team === null || !isApplicationTeam(team.name)) {
      return null
    }

    const allowed = await userCanAccessTeam(
      ctx,
      principal.userId,
      args.teamId,
      principal.teamNames
    )
    if (!allowed) {
      return null
    }

    if (!isTeamSidebarPageEnabled(team, args.page)) {
      return null
    }

    return { _id: team._id, name: team.name }
  },
})

export const listForUserManagement = query({
  args: {},
  returns: v.array(teamSummary),
  handler: async (ctx) => {
    await requireUserManagement(ctx)
    const teams = await collectAll(ctx, "teams")
    return teams
      .map((team) => toTeamSummary(team))
      .sort((left, right) => left.name.localeCompare(right.name))
  },
})
