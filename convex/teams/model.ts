import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import type { TeamName } from "@/convex/permissions/shared"

type TeamCtx = QueryCtx | MutationCtx

export async function getTeamByName(ctx: TeamCtx, name: string) {
  return await ctx.db
    .query("teams")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique()
}

export async function ensureTeamByName(
  ctx: MutationCtx,
  name: string
): Promise<Id<"teams">> {
  const existing = await getTeamByName(ctx, name)
  if (existing !== null) {
    return existing._id
  }
  return await ctx.db.insert("teams", { name })
}

export async function getMembership(
  ctx: TeamCtx,
  teamId: Id<"teams">,
  userId: Id<"users">
) {
  return await ctx.db
    .query("teamMemberships")
    .withIndex("by_teamId_and_userId", (q) =>
      q.eq("teamId", teamId).eq("userId", userId)
    )
    .unique()
}

export async function addTeamMember(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  userId: Id<"users">
): Promise<void> {
  const existing = await getMembership(ctx, teamId, userId)
  if (existing !== null) {
    return
  }
  await ctx.db.insert("teamMemberships", { teamId, userId })
}

export async function removeTeamMember(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  userId: Id<"users">
): Promise<void> {
  const membership = await getMembership(ctx, teamId, userId)
  if (membership === null) {
    return
  }
  await ctx.db.delete("teamMemberships", membership._id)
}

export async function listTeamNamesForUser(
  ctx: TeamCtx,
  userId: Id<"users">
): Promise<string[]> {
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()

  const names: string[] = []
  for (const membership of memberships) {
    const team = await ctx.db.get("teams", membership.teamId)
    if (team !== null) {
      names.push(team.name)
    }
  }
  return names
}

export async function listMemberIdsForTeam(
  ctx: TeamCtx,
  teamId: Id<"teams">
): Promise<Id<"users">[]> {
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .collect()
  return memberships.map((membership) => membership.userId)
}

export async function isMemberOfTeam(
  ctx: TeamCtx,
  userId: Id<"users">,
  teamName: TeamName
): Promise<boolean> {
  const team = await getTeamByName(ctx, teamName)
  if (team === null) {
    return false
  }
  const membership = await getMembership(ctx, team._id, userId)
  return membership !== null
}

export function teamIdsForTeamNames(
  teams: Iterable<{ _id: Id<"teams">; name: string }>,
  teamNames: ReadonlySet<string>
): Set<Id<"teams">> {
  const teamIds = new Set<Id<"teams">>()
  for (const team of teams) {
    if (teamNames.has(team.name)) {
      teamIds.add(team._id)
    }
  }
  return teamIds
}

export async function listMembersForTeams(
  ctx: TeamCtx,
  teamNames: readonly TeamName[]
): Promise<Set<Id<"users">>> {
  const members = new Set<Id<"users">>()
  for (const teamName of teamNames) {
    const team = await getTeamByName(ctx, teamName)
    if (team === null) {
      continue
    }
    const memberIds = await listMemberIdsForTeam(ctx, team._id)
    for (const memberId of memberIds) {
      members.add(memberId)
    }
  }
  return members
}
