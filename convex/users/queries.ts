import { collectAll } from "@/convex/utils"
import { query, type QueryCtx } from "@/convex/_generated/server"
import {
  canPerform,
  getPrincipalOrNull,
  requireCan,
  requirePrincipal,
  requireUserManagement,
} from "@/convex/permissions/principal"
import {
  buildTeamSummariesByUserId,
  getTeamByName,
  getMembership,
  listTeamSummariesForUser,
} from "@/convex/teams/model"
import { TEAM_NAMES, teamNameValidator } from "@/convex/permissions/shared"
import { resolveUserAvatarUrl } from "@/convex/users/avatar"
import { toAdminUserSummary } from "@/convex/users/adminModel"
import {
  adminUserSummaryValidator,
  publicUserValidator,
  type PublicUser,
} from "./validators"
import { v } from "convex/values"
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server"
import { commentTargetRef, type CommentTargetRef } from "@/convex/utils"
import {
  canManageTaskWithRoots,
  requireTaskManageAccess,
  requireTaskReadAccess,
} from "@/convex/tasks/access"
import { concreteAssigneeIds } from "@/convex/tasks/assignees"
import { canUpdateProject } from "@/convex/projects/access"
import {
  requireScopedObjectForRead,
  requireScopedObjectForUpdate,
} from "@/convex/access/scopedObject"
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

async function getEnabledPublicUsers(
  ctx: QueryCtx,
  ids: Iterable<Id<"users">>
) {
  const users = await Promise.all(
    [...new Set(ids)].map((id) => ctx.db.get("users", id))
  )
  return users.flatMap((user) =>
    user === null || user.disabled === true ? [] : [toPublicUser(user)]
  )
}

async function requireSelectorEditAccess(
  ctx: QueryCtx,
  scope: CommentTargetRef | undefined
) {
  if (scope === undefined) {
    const principal = await requirePrincipal(ctx)
    requireCan(principal, "read", "User")
    return { principal, competition: null }
  }
  if (scope.type === "tasks") {
    const { principal, rootCompetition } = await requireTaskManageAccess(
      ctx,
      scope.id
    )
    return { principal, competition: rootCompetition }
  }
  const { principal, doc } = await requireScopedObjectForUpdate(ctx, scope)
  return { principal, competition: "people" in doc ? doc : null }
}

// Editors can resolve draft selections. Read-only viewers can resolve only
// users already referenced by the scope, unless they can read the directory.
async function readableSelectedIds(
  ctx: QueryCtx,
  scope: CommentTargetRef | undefined,
  ids: Id<"users">[]
): Promise<Id<"users">[]> {
  if (scope === undefined) {
    requireCan(await requirePrincipal(ctx), "read", "User")
    return ids
  }
  if (scope.type === "tasks") {
    const access = await requireTaskReadAccess(ctx, scope.id)
    if (
      canPerform(access.principal, "read", "User") ||
      (await canManageTaskWithRoots(ctx, access.principal, access))
    )
      return ids
    const referenced = new Set(concreteAssigneeIds(access.task.assigneeIds))
    if (access.task.owner?.type === "users")
      referenced.add(access.task.owner.id)
    return ids.filter((id) => referenced.has(id))
  }
  const { principal, doc } = await requireScopedObjectForRead(ctx, scope)
  if (canPerform(principal, "read", "User")) return ids
  if ("people" in doc) {
    if (canPerform(principal, "update", "Competition", doc)) return ids
    const { compLead, leadDelegate, organisers } = doc.people
    const referenced = new Set([compLead, leadDelegate, ...organisers])
    return ids.filter((id) => referenced.has(id))
  }
  if (await canUpdateProject(ctx, principal, doc)) return ids
  const readable = await Promise.all(
    ids.map(async (id) => {
      if (id === doc.leadUserId) return id
      const member = await ctx.db
        .query("projectMembers")
        .withIndex("by_projectId_and_member_type_and_member_id", (q) =>
          q
            .eq("projectId", doc._id)
            .eq("member.type", "users")
            .eq("member.id", id)
        )
        .first()
      return member === null ? null : id
    })
  )
  return readable.filter((id) => id !== null)
}

export const list = query({
  args: {
    scope: v.optional(commentTargetRef),
    teamName: v.optional(teamNameValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(publicUserValidator),
  handler: async (ctx, args) => {
    const { principal } = await requireSelectorEditAccess(ctx, args.scope)
    const team = await getTeamByName(ctx, args.teamName ?? TEAM_NAMES.VOLUNTEER)
    const memberships =
      team === null
        ? { page: [], isDone: true, continueCursor: "" }
        : await ctx.db
            .query("teamMemberships")
            .withIndex("by_teamId_and_userId", (q) => q.eq("teamId", team._id))
            .paginate({
              ...args.paginationOpts,
              numItems: Math.min(args.paginationOpts.numItems, 100),
            })
    const ids = new Set(memberships.page.map((membership) => membership.userId))
    // Include yourself on the first page even when your membership sorts later.
    // Role-specific pickers still require membership in that role.
    if (
      args.paginationOpts.cursor === null &&
      team !== null &&
      (await getMembership(ctx, team._id, principal.userId)) !== null
    ) {
      ids.add(principal.userId)
    }
    return {
      ...memberships,
      page: await getEnabledPublicUsers(ctx, ids),
    }
  },
})

// Keep competition-specific additions separate so ordinary directory pages
// can be shared across tasks and projects by callers with directory access.
export const listScopeOrganisers = query({
  args: { scope: commentTargetRef },
  returns: v.array(publicUserValidator),
  handler: async (ctx, { scope }) => {
    const { competition } = await requireSelectorEditAccess(ctx, scope)
    return await getEnabledPublicUsers(
      ctx,
      competition?.people.organisers ?? []
    )
  },
})

// Labels are independent of the directory's pages and may include disabled
// accounts. The client keeps the selected IDs authoritative while this loads.
export const getSelected = query({
  args: { userIds: v.array(v.string()), scope: v.optional(commentTargetRef) },
  returns: v.array(publicUserValidator),
  handler: async (ctx, args) => {
    const ids = args.userIds.flatMap((id) => {
      const userId = ctx.db.normalizeId("users", id)
      return userId === null ? [] : [userId]
    })
    const readable = await readableSelectedIds(ctx, args.scope, [
      ...new Set(ids),
    ])
    return await getPublicUsers(ctx, readable)
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
