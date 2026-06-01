import { collectAll } from "@/convex/utils"
import { query } from "@/convex/_generated/server"
import {
  requireCan,
  requirePrincipal,
  requireUserManagement,
} from "@/convex/permissions/principal"
import { ADMIN_ASSIGNABLE_TEAM_NAMES } from "@/convex/permissions/shared"
import { listMemberIdsForTeam } from "@/convex/teams/model"
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

export const listForUserManagement = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      name: v.string(),
    })
  ),
  handler: async (ctx) => {
    await requireUserManagement(ctx)
    const teams = await collectAll(ctx, "teams")
    return teams
      .filter((team) => assignableTeamNames.has(team.name))
      .map((team) => ({ _id: team._id, name: team.name }))
  },
})
