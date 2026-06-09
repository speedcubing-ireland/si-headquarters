import type { Doc, Id } from "@/convex/_generated/dataModel"
import { throwForbidden, throwNotFound } from "@/convex/errors"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { getMembership } from "@/convex/teams/model"

type DbCtx = QueryCtx | MutationCtx
type ProjectScope = Doc<"projects">["scope"]
const MAX_PROJECT_MEMBERS_FOR_ACCESS = 100

function isDirector(principal: Principal): boolean {
  return principal.teamNames.includes(TEAM_NAMES.DIRECTORS)
}

function isVolunteer(principal: Principal): boolean {
  return principal.teamNames.includes(TEAM_NAMES.VOLUNTEER)
}

function isProjectLead(
  principal: Principal,
  project: Doc<"projects">
): boolean {
  return project.leadUserId === principal.userId
}

async function isTeamMember(
  ctx: DbCtx,
  teamId: Id<"teams">,
  userId: Id<"users">
): Promise<boolean> {
  return (await getMembership(ctx, teamId, userId)) !== null
}

async function isProjectMember(
  ctx: DbCtx,
  projectId: Id<"projects">,
  principal: Principal
): Promise<boolean> {
  const rows = await ctx.db
    .query("projectMembers")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .take(MAX_PROJECT_MEMBERS_FOR_ACCESS + 1)

  if (rows.length > MAX_PROJECT_MEMBERS_FOR_ACCESS) {
    throw new Error("Project has too many members to authorize.")
  }

  for (const row of rows) {
    if (row.member.type === "users" && row.member.id === principal.userId) {
      return true
    }
    if (
      row.member.type === "teams" &&
      (await isTeamMember(ctx, row.member.id, principal.userId))
    ) {
      return true
    }
  }

  return false
}

export async function canCreateProjectForScope(
  ctx: DbCtx,
  principal: Principal,
  scope: ProjectScope
): Promise<boolean> {
  if (isDirector(principal)) {
    return true
  }

  if (scope.type === "global") {
    return isVolunteer(principal)
  }

  return await isTeamMember(ctx, scope.id, principal.userId)
}

export async function canReadProject(
  ctx: DbCtx,
  principal: Principal,
  project: Doc<"projects">
): Promise<boolean> {
  if (isDirector(principal)) {
    return true
  }

  if (isProjectLead(principal, project)) {
    return true
  }

  if (await isProjectMember(ctx, project._id, principal)) {
    return true
  }

  if (project.scope.type === "global" && isVolunteer(principal)) {
    return true
  }

  if (
    project.scope.type === "teams" &&
    (await isTeamMember(ctx, project.scope.id, principal.userId))
  ) {
    return true
  }

  return false
}

export async function canUpdateProject(
  ctx: DbCtx,
  principal: Principal,
  project: Doc<"projects">
): Promise<boolean> {
  if (isDirector(principal)) {
    return true
  }

  if (isProjectLead(principal, project)) {
    return true
  }

  return await isProjectMember(ctx, project._id, principal)
}

export function canManageProject(
  principal: Principal,
  project: Doc<"projects">
): boolean {
  return isDirector(principal) || isProjectLead(principal, project)
}

export async function getProjectOrNull(
  ctx: DbCtx,
  id: Id<"projects">
): Promise<Doc<"projects"> | null> {
  return await ctx.db.get("projects", id)
}

export async function requireProjectForRead(
  ctx: DbCtx,
  id: Id<"projects">
): Promise<{ principal: Principal; project: Doc<"projects"> }> {
  const principal = await requirePrincipal(ctx)
  const project = await getProjectOrNull(ctx, id)
  if (project === null) {
    throwNotFound("Project not found")
  }

  if (!(await canReadProject(ctx, principal, project))) {
    throwForbidden()
  }

  return { principal, project }
}

export async function requireProjectForUpdate(
  ctx: DbCtx,
  id: Id<"projects">
): Promise<{ principal: Principal; project: Doc<"projects"> }> {
  const principal = await requirePrincipal(ctx)
  const project = await getProjectOrNull(ctx, id)
  if (project === null) {
    throwNotFound("Project not found")
  }

  if (!(await canUpdateProject(ctx, principal, project))) {
    throwForbidden()
  }

  return { principal, project }
}

export async function requireProjectForManage(
  ctx: DbCtx,
  id: Id<"projects">
): Promise<{ principal: Principal; project: Doc<"projects"> }> {
  const principal = await requirePrincipal(ctx)
  const project = await getProjectOrNull(ctx, id)
  if (project === null) {
    throwNotFound("Project not found")
  }

  if (!canManageProject(principal, project)) {
    throwForbidden()
  }

  return { principal, project }
}

export async function requireProjectCreateForScope(
  ctx: DbCtx,
  scope: ProjectScope
): Promise<Principal> {
  const principal = await requirePrincipal(ctx)
  if (!(await canCreateProjectForScope(ctx, principal, scope))) {
    throwForbidden("You do not have permission to create this project.")
  }
  return principal
}
