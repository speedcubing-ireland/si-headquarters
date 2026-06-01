import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import type { TeamName } from "./constants"

export type TeamCtx = QueryCtx | MutationCtx

export async function isMemberOfTeam(
  ctx: TeamCtx,
  userId: Id<"users">,
  teamName: TeamName,
): Promise<boolean> {
  const team = await ctx.db
    .query("teams")
    .withIndex("by_name", (q) => q.eq("name", teamName))
    .unique()
  if (team === null) {
    return false
  }
  return team.memberIds.includes(userId)
}

export async function isMemberOfAnyTeam(
  ctx: TeamCtx,
  userId: Id<"users">,
  teamNames: readonly TeamName[],
): Promise<boolean> {
  if (teamNames.length === 0) {
    return false
  }
  const checks = await Promise.all(
    teamNames.map((teamName) => isMemberOfTeam(ctx, userId, teamName)),
  )
  return checks.some(Boolean)
}

export async function listMembersForTeams(
  ctx: TeamCtx,
  teamNames: readonly TeamName[],
): Promise<Set<Id<"users">>> {
  const teams = await Promise.all(
    teamNames.map((teamName) =>
      ctx.db
        .query("teams")
        .withIndex("by_name", (q) => q.eq("name", teamName))
        .unique(),
    ),
  )
  const members = new Set<Id<"users">>()
  for (const team of teams) {
    if (team === null) {
      continue
    }
    for (const memberId of team.memberIds) {
      members.add(memberId)
    }
  }
  return members
}
