import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  TEAM_NAMES,
  isTeamName,
  type Action,
  type Permission,
  type Subject,
  type TeamName,
} from "@/convex/permissions/shared"
import { listTeamNamesForUser } from "@/convex/teams/model"

export interface Principal {
  userId: Id<"users">
  teamNames: TeamName[]
}

type AuthCtx = QueryCtx | MutationCtx

const TEAM_GRANTS: Partial<Record<TeamName, readonly Permission[]>> = {
  [TEAM_NAMES.VOLUNTEER]: [
    { action: "manage", subject: "Competition" },
    { action: "read", subject: "Project" },
    { action: "create", subject: "Project" },
    { action: "read", subject: "Team" },
    { action: "read", subject: "User" },
    { action: "manage", subject: "Task" },
    { action: "access", subject: "SocialMediaDashboard" },
  ],
  [TEAM_NAMES.DIRECTORS]: [
    { action: "manage", subject: "all" },
    { action: "manage", subject: "UserManagement" },
    { action: "access", subject: "SponsorPortalAdmin" },
  ],
  [TEAM_NAMES.COMPETITIONS]: [
    { action: "manage", subject: "Competition" },
    { action: "read", subject: "User" },
    { action: "access", subject: "Wca2fa" },
  ],
  [TEAM_NAMES.DELEGATES]: [{ action: "access", subject: "Wca2fa" }],
  [TEAM_NAMES.FINANCE]: [{ action: "access", subject: "SponsorPortalAdmin" }],
  [TEAM_NAMES.SOCIAL_MEDIA]: [
    { action: "access", subject: "SocialMediaDashboard" },
  ],
}

function teamGrants(teamName: TeamName): readonly Permission[] {
  const grants: readonly Permission[] | undefined = TEAM_GRANTS[teamName]
  return grants ?? []
}

function hasTeam(principal: Principal, teamName: TeamName): boolean {
  return principal.teamNames.includes(teamName)
}

export function isDirector(principal: Principal): boolean {
  return hasTeam(principal, TEAM_NAMES.DIRECTORS)
}

function hasDirectGrant(
  principal: Principal,
  action: Action,
  subject: Subject
): boolean {
  if (hasTeam(principal, TEAM_NAMES.DIRECTORS)) {
    return true
  }

  return principal.teamNames.some((teamName) =>
    teamGrants(teamName).some(
      (grant) =>
        (grant.action === action || grant.action === "manage") &&
        (grant.subject === subject || grant.subject === "all")
    )
  )
}

function isCompetitionOrganiser(
  principal: Principal,
  competition: Doc<"competitions"> | undefined
): boolean {
  return competition?.people.organisers.includes(principal.userId) ?? false
}

export function isCompetitionSteward(
  principal: Principal,
  competition: Doc<"competitions"> | undefined
): boolean {
  if (competition === undefined) return false
  return (
    competition.people.compLead === principal.userId ||
    competition.people.leadDelegate === principal.userId
  )
}

export function canPerform(
  principal: Principal | null,
  action: Action,
  subject: Subject,
  competition?: Doc<"competitions">
): boolean {
  if (principal === null) {
    return false
  }

  if (hasDirectGrant(principal, action, subject)) {
    return true
  }

  return (
    subject === "Competition" &&
    (action === "read" || action === "update") &&
    (isCompetitionOrganiser(principal, competition) ||
      isCompetitionSteward(principal, competition))
  )
}

function throwForbidden(message: string): never {
  throw new ConvexError({
    code: "FORBIDDEN",
    message,
  })
}

export async function buildPrincipalForUserId(
  ctx: AuthCtx,
  userId: Id<"users">
): Promise<Principal | null> {
  const user = await ctx.db.get("users", userId)
  if (user === null || user.disabled === true) {
    return null
  }

  return {
    userId,
    teamNames: (await listTeamNamesForUser(ctx, userId)).filter(isTeamName),
  }
}

export async function getPrincipalOrNull(
  ctx: AuthCtx
): Promise<Principal | null> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) {
    return null
  }
  return await buildPrincipalForUserId(ctx, userId)
}

export async function requirePrincipal(ctx: AuthCtx): Promise<Principal> {
  const principal = await getPrincipalOrNull(ctx)
  if (principal === null) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    })
  }
  return principal
}

export async function requireActiveUserId(ctx: AuthCtx): Promise<Id<"users">> {
  return (await requirePrincipal(ctx)).userId
}

export function requireCan(
  principal: Principal,
  action: Action,
  subject: Subject,
  competition?: Doc<"competitions">,
  message?: string
): void {
  if (!canPerform(principal, action, subject, competition)) {
    throwForbidden(
      message ?? "You do not have permission to perform this action."
    )
  }
}

export async function requireTaskManagement(ctx: AuthCtx): Promise<Principal> {
  const principal = await requirePrincipal(ctx)
  requireCan(principal, "manage", "Task")
  return principal
}

export async function requireCompetitionManagement(
  ctx: AuthCtx
): Promise<Principal> {
  const principal = await requirePrincipal(ctx)
  requireCan(principal, "manage", "Competition")
  return principal
}

export async function requireUserManagement(
  ctx: AuthCtx
): Promise<Id<"users">> {
  const principal = await requirePrincipal(ctx)
  requireCan(principal, "manage", "UserManagement")
  return principal.userId
}

export async function requireDirector(ctx: AuthCtx): Promise<Id<"users">> {
  const principal = await requirePrincipal(ctx)
  if (!hasTeam(principal, TEAM_NAMES.DIRECTORS)) {
    throwForbidden("Directors only.")
  }
  return principal.userId
}

export async function requireSponsorPortalAdmin(
  ctx: AuthCtx
): Promise<Id<"users">> {
  const principal = await requirePrincipal(ctx)
  requireCan(
    principal,
    "access",
    "SponsorPortalAdmin",
    undefined,
    "Directors or Finance Team only."
  )
  return principal.userId
}

export function canAccessSponsorPortalAdminForUser(
  principal: Principal | null
): boolean {
  return canPerform(principal, "access", "SponsorPortalAdmin")
}

export async function requireWca2faAccess(ctx: AuthCtx): Promise<Id<"users">> {
  const principal = await requirePrincipal(ctx)
  requireCan(
    principal,
    "access",
    "Wca2fa",
    undefined,
    "Directors, Delegates, or Competitions Team members only."
  )
  return principal.userId
}

export async function requireSocialMediaDashboardAccess(
  ctx: AuthCtx
): Promise<Id<"users">> {
  const principal = await requirePrincipal(ctx)
  requireCan(
    principal,
    "access",
    "SocialMediaDashboard",
    undefined,
    "Volunteer access required."
  )
  return principal.userId
}

export function permissionsFor(principal: Principal | null): Permission[] {
  if (principal === null) {
    return []
  }

  const permissions = new Map<string, Permission>()
  for (const teamName of principal.teamNames) {
    for (const permission of teamGrants(teamName)) {
      permissions.set(`${permission.action}:${permission.subject}`, permission)
    }
  }
  return [...permissions.values()]
}
