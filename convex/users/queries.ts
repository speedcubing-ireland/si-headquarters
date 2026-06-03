import { collectAll } from "@/convex/utils"
import { query, type QueryCtx } from "@/convex/_generated/server"
import {
  getPrincipalOrNull,
  requireCan,
  requirePrincipal,
  requireUserManagement,
} from "@/convex/permissions/principal"
import {
  buildTeamSummariesByUserId,
  getTeamByName,
  listMemberIdsForTeam,
  listTeamSummariesForUser,
} from "@/convex/teams/model"
import { teamNameValidator } from "@/convex/teams/validators"
import { resolveUserAvatarUrl } from "@/convex/users/avatar"
import { toAdminUserSummary } from "@/convex/users/adminModel"
import {
  adminUserSummaryValidator,
  publicUserValidator,
  type PublicUser,
} from "./validators"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"

export function toPublicUser(
  user: Pick<
    Doc<"users">,
    "_id" | "name" | "image" | "discordUserId" | "discordAvatarHash"
  >
): PublicUser {
  return {
    _id: user._id,
    name: user.name,
    image: resolveUserAvatarUrl(user) ?? user.image,
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
  returns: v.array(adminUserSummaryValidator),
  handler: async (ctx) => {
    await requireUserManagement(ctx)
    const [users, teamsByUserId] = await Promise.all([
      collectAll(ctx, "users"),
      buildTeamSummariesByUserId(ctx),
    ])

    return users.map((user) =>
      toAdminUserSummary(user, teamsByUserId.get(user._id) ?? [])
    )
  },
})

export const getForAdmin = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(adminUserSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    await requireUserManagement(ctx)
    const user = await ctx.db.get("users", args.userId)
    if (user === null) {
      return null
    }
    const teams = await listTeamSummariesForUser(ctx, user._id)
    return toAdminUserSummary(user, teams)
  },
})

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const principal = await getPrincipalOrNull(ctx)
    if (principal === null) {
      return null
    }
    const user = await ctx.db.get("users", principal.userId)
    if (user === null) {
      return null
    }
    return {
      ...user,
      image: resolveUserAvatarUrl(user) ?? user.image,
    }
  },
})
