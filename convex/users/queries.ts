import { collectAll } from "@/convex/utils"
import { query, type QueryCtx } from "@/convex/_generated/server"
import {
  getPrincipalOrNull,
  requireCan,
  requirePrincipal,
  requireUserManagement,
} from "@/convex/permissions/principal"
import { getTeamByName, listMemberIdsForTeam } from "@/convex/teams/model"
import { teamNameValidator } from "@/convex/teams/validators"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import { publicUserValidator, type PublicUser } from "./validators"

export function toPublicUser(
  user: Pick<Doc<"users">, "_id" | "name" | "image">
): PublicUser {
  return {
    _id: user._id,
    name: user.name,
    image: user.image,
  }
}

export async function getPublicUser(
  ctx: QueryCtx,
  userId: Id<"users"> | null
): Promise<PublicUser | null> {
  if (!userId) return null

  const user = await ctx.db.get("users", userId)
  return user ? toPublicUser(user) : null
}

export async function getPublicUsers(
  ctx: QueryCtx,
  userIds: Id<"users">[]
): Promise<PublicUser[]> {
  const users = await Promise.all(
    userIds.map((userId) => ctx.db.get("users", userId))
  )
  return users
    .filter((user): user is Doc<"users"> => user !== null)
    .map(toPublicUser)
}

export const list = query({
  args: {
    teamName: v.optional(teamNameValidator),
  },
  returns: v.array(publicUserValidator),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    requireCan(principal, "read", "User")
    if (args.teamName !== undefined) {
      const team = await getTeamByName(ctx, args.teamName)
      if (team === null) {
        return []
      }
      const memberIds = await listMemberIdsForTeam(ctx, team._id)
      return await getPublicUsers(ctx, memberIds)
    }

    const users = await collectAll(ctx, "users")

    return users.map(toPublicUser)
  },
})

export const listForCompetition = query({
  args: {
    competitionId: v.id("competitions"),
    teamName: v.optional(teamNameValidator),
  },
  returns: v.array(publicUserValidator),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const competition = await ctx.db.get("competitions", args.competitionId)
    if (competition === null) {
      return []
    }
    requireCan(principal, "manage", "Competition", competition)

    if (args.teamName !== undefined) {
      const team = await getTeamByName(ctx, args.teamName)
      if (team === null) {
        return []
      }
      const memberIds = await listMemberIdsForTeam(ctx, team._id)
      return await getPublicUsers(ctx, memberIds)
    }

    const users = await collectAll(ctx, "users")
    return users.map(toPublicUser)
  },
})

export const listForAdmin = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      disabled: v.optional(v.boolean()),
      teams: v.array(
        v.object({
          _id: v.id("teams"),
          name: v.string(),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    await requireUserManagement(ctx)
    const [users, teams, memberships] = await Promise.all([
      collectAll(ctx, "users"),
      collectAll(ctx, "teams"),
      collectAll(ctx, "teamMemberships"),
    ])
    const teamById = new Map(teams.map((team) => [team._id, team]))
    const teamsByUserId = new Map<
      Id<"users">,
      { _id: Id<"teams">; name: string }[]
    >()

    for (const membership of memberships) {
      const team = teamById.get(membership.teamId)
      if (team === undefined) {
        continue
      }
      const entry = { _id: team._id, name: team.name }
      const existing = teamsByUserId.get(membership.userId) ?? []
      existing.push(entry)
      teamsByUserId.set(membership.userId, existing)
    }

    return users.map((user) => ({
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      image: user.image,
      email: user.email,
      disabled: user.disabled,
      teams: teamsByUserId.get(user._id) ?? [],
    }))
  },
})

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const principal = await getPrincipalOrNull(ctx)
    if (principal === null) {
      return null
    }
    return await ctx.db.get("users", principal.userId)
  },
})
