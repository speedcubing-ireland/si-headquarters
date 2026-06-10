import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  NON_APPLICATION_TEAM_NAME_SET,
  TEAM_NAMES,
  type TeamName,
} from "@/convex/permissions/shared"
import type { TeamSummary } from "@/convex/teams/validators"
import { collectAll } from "@/convex/utils"

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

export async function isTeamMember(
  ctx: TeamCtx,
  teamId: Id<"teams">,
  userId: Id<"users">
) {
  return (await getMembership(ctx, teamId, userId)) !== null
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

export function toTeamSummary(team: Pick<Doc<"teams">, "_id" | "name">) {
  return { _id: team._id, name: team.name }
}

function compareTeamSummariesByName(
  left: TeamSummary,
  right: TeamSummary
): number {
  return left.name.localeCompare(right.name)
}

export function isApplicationTeam(name: string): boolean {
  return !NON_APPLICATION_TEAM_NAME_SET.has(name)
}

export function applicationTeamSummaries(
  teams: readonly Pick<Doc<"teams">, "_id" | "name">[]
): TeamSummary[] {
  return teams
    .filter((team) => isApplicationTeam(team.name))
    .map(toTeamSummary)
    .sort(compareTeamSummariesByName)
}

export async function listTeamSummariesForUser(
  ctx: TeamCtx,
  userId: Id<"users">
) {
  const teams = await listTeamsForUser(ctx, userId)
  return teams.map(toTeamSummary).sort(compareTeamSummariesByName)
}

export async function listApplicationTeamSummariesForUser(
  ctx: TeamCtx,
  userId: Id<"users">
) {
  return applicationTeamSummaries(await listTeamsForUser(ctx, userId))
}

export async function listAllApplicationTeamSummaries(ctx: TeamCtx) {
  return applicationTeamSummaries(await collectAll(ctx, "teams"))
}

export async function takeApplicationTeamSummaries(
  ctx: TeamCtx,
  limit: number
) {
  return applicationTeamSummaries(await ctx.db.query("teams").take(limit))
}

async function listTeamsForUser(ctx: TeamCtx, userId: Id<"users">) {
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()

  const teams = await Promise.all(
    memberships.map((membership) => ctx.db.get("teams", membership.teamId))
  )
  return teams.filter((team) => team !== null)
}

export async function userCanAccessTeam(
  ctx: TeamCtx,
  userId: Id<"users">,
  teamId: Id<"teams">,
  teamNames: readonly TeamName[]
): Promise<boolean> {
  if (teamNames.includes(TEAM_NAMES.DIRECTORS)) {
    return true
  }
  return (await getMembership(ctx, teamId, userId)) !== null
}

export async function listTeamNamesForUser(
  ctx: TeamCtx,
  userId: Id<"users">
): Promise<string[]> {
  const teams = await listTeamsForUser(ctx, userId)
  return teams.map((team) => team.name)
}

export async function listMemberIdsForTeam(
  ctx: TeamCtx,
  teamId: Id<"teams">
): Promise<Id<"users">[]> {
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_teamId_and_userId", (q) => q.eq("teamId", teamId))
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

export async function buildTeamSummariesByUserId(
  ctx: TeamCtx
): Promise<Map<Id<"users">, TeamSummary[]>> {
  const [teams, memberships] = await Promise.all([
    collectAll(ctx, "teams"),
    collectAll(ctx, "teamMemberships"),
  ])
  const teamById = new Map(teams.map((team) => [team._id, team]))
  const teamsByUserId = new Map<Id<"users">, TeamSummary[]>()

  for (const membership of memberships) {
    const team = teamById.get(membership.teamId)
    if (team === undefined) {
      continue
    }
    const existing = teamsByUserId.get(membership.userId) ?? []
    existing.push(toTeamSummary(team))
    teamsByUserId.set(membership.userId, existing)
  }

  for (const entries of teamsByUserId.values()) {
    entries.sort(compareTeamSummariesByName)
  }

  return teamsByUserId
}
