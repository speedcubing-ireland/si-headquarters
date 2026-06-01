import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { TEAM_NAMES, type TeamName } from "@/convex/permissions/shared"
import { addTeamMember, ensureTeamByName } from "@/convex/teams/model"
import type { TestConvex } from "convex-test"
import type schema from "@/convex/schema"

export async function ensureVolunteerMembership(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<void> {
  const teamId = await ensureTeamByName(ctx, TEAM_NAMES.VOLUNTEER)
  await addTeamMember(ctx, teamId, userId)
}

export async function addUserToTeam(
  ctx: MutationCtx,
  userId: Id<"users">,
  teamName: TeamName
): Promise<void> {
  const teamId = await ensureTeamByName(ctx, teamName)
  await addTeamMember(ctx, teamId, userId)
}

export async function insertTestUser(
  ctx: MutationCtx,
  name: string
): Promise<Id<"users">> {
  return await ctx.db.insert("users", { name })
}

export async function seedVolunteerTestUser(
  ctx: MutationCtx,
  name = "Test User"
): Promise<Id<"users">> {
  const userId = await insertTestUser(ctx, name)
  await ensureVolunteerMembership(ctx, userId)
  return userId
}

export async function withVolunteerTestClient(t: TestConvex<typeof schema>) {
  const userId = await t.run(async (ctx) => seedVolunteerTestUser(ctx))
  return {
    client: t.withIdentity({ subject: userId }),
    userId,
  }
}

export async function insertBlankCompetition(
  ctx: MutationCtx
): Promise<Id<"competitions">> {
  return await ctx.db.insert("competitions", {
    name: "Spring Open",
    description: null,
    people: {
      compLead: null,
      leadDelegate: null,
      organisers: [],
    },
    compDates: { from: null, to: null },
    phaseId: null,
    updateId: null,
  })
}

export async function seedDirectorUser(
  ctx: MutationCtx
): Promise<Id<"users">> {
  const userId = await ctx.db.insert("users", {})
  const teamId = await ensureTeamByName(ctx, TEAM_NAMES.DIRECTORS)
  await addTeamMember(ctx, teamId, userId)
  return userId
}
