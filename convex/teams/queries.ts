import { collectAll } from "@/convex/utils"
import { query } from "@/convex/_generated/server"
import {
  requireCan,
  requirePrincipal,
  requireUserManagement,
} from "@/convex/permissions/principal"
import { ADMIN_ASSIGNABLE_TEAM_NAMES } from "@/convex/permissions/shared"
import {
  listMemberIdsForTeam,
  listTeamSummariesForUser,
  toTeamSummary,
  userCanAccessTeam,
} from "@/convex/teams/model"
import { teamSummary } from "@/convex/teams/validators"
import { v } from "convex/values"

const assignableTeamNames = new Set<string>(ADMIN_ASSIGNABLE_TEAM_NAMES)

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
  returns: v.array(teamSummary),
  handler: async (ctx) => {
    const principal = await requirePrincipal(ctx)
    return await listTeamSummariesForUser(ctx, principal.userId)
  },
})

export const listForTaskFilters = query({
  args: {},
  returns: v.array(teamSummary),
  handler: async (ctx) => {
    const principal = await requirePrincipal(ctx)
    requireCan(principal, "read", "Team")
    return (await collectAll(ctx, "teams"))
      .map(toTeamSummary)
      .sort((left, right) => left.name.localeCompare(right.name))
  },
})

export const getForTaskPage = query({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.union(teamSummary, v.null()),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const team = await ctx.db.get("teams", args.teamId)
    if (team === null) {
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
      .filter((team) => assignableTeamNames.has(team.name))
      .map(toTeamSummary)
      .sort((left, right) => left.name.localeCompare(right.name))
  },
})
