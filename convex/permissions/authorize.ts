import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  getUserIdOrNull,
  requireAuthenticatedUserId,
} from "@/convex/permissions/authn"
import { TEAM_NAMES } from "@/convex/permissions/constants"
import { throwForbidden } from "@/convex/permissions/errors"
import { isMemberOfAnyTeam } from "@/convex/permissions/teams"

type AuthorizeCtx = QueryCtx | MutationCtx

export const PERMISSION_KEYS = {
  SPONSORSHIP_MANAGER: "sponsorshipManager",
} as const

export type PermissionKey =
  (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS]

const DEFAULT_FORBIDDEN_MESSAGES: Record<PermissionKey, string> = {
  [PERMISSION_KEYS.SPONSORSHIP_MANAGER]: "Directors or Finance Team only.",
}

const PERMISSION_CHECKERS: Record<
  PermissionKey,
  (ctx: AuthorizeCtx, userId: Id<"users">) => Promise<boolean>
> = {
  [PERMISSION_KEYS.SPONSORSHIP_MANAGER]: (ctx, userId) =>
    isMemberOfAnyTeam(ctx, userId, [TEAM_NAMES.DIRECTORS, TEAM_NAMES.FINANCE]),
}

async function hasPermissionForUser(
  ctx: AuthorizeCtx,
  userId: Id<"users">,
  key: PermissionKey,
): Promise<boolean> {
  return PERMISSION_CHECKERS[key](ctx, userId)
}

export async function requirePermission(
  ctx: AuthorizeCtx,
  key: PermissionKey,
  message?: string,
): Promise<Id<"users">> {
  const userId = await requireAuthenticatedUserId(ctx)
  const allowed = await hasPermissionForUser(ctx, userId, key)
  if (!allowed) {
    throwForbidden(message ?? DEFAULT_FORBIDDEN_MESSAGES[key])
  }
  return userId
}

export async function hasPermission(
  ctx: AuthorizeCtx,
  key: PermissionKey,
  userId: Id<"users"> | null,
): Promise<boolean> {
  if (userId === null) {
    return false
  }
  return hasPermissionForUser(ctx, userId, key)
}

export async function isSponsorshipManagerForCtx(
  ctx: AuthorizeCtx,
): Promise<boolean> {
  const userId = await getUserIdOrNull(ctx)
  return hasPermission(ctx, PERMISSION_KEYS.SPONSORSHIP_MANAGER, userId)
}
