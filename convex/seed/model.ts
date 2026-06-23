import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { DEFAULT_TASK_LABELS } from "@/convex/tasks/labels/constants"
import { ensureDefaultTaskLabels } from "@/convex/tasks/labels/model"
import { addTeamMember, ensureTeamByName } from "@/convex/teams/model"
import { collectAll } from "@/convex/utils"

export interface SeedInitialDataResult {
  teamsEnsured: number
  labelsEnsured: number
  directorAssigned: boolean
  directorUserId: Id<"users"> | null
}

export async function createInitialUser(
  ctx: MutationCtx,
  args: { wcaUserId: number; name: string; email?: string }
): Promise<Id<"users">> {
  const existing = await ctx.db.query("users").first()
  if (existing !== null) {
    throw new Error(
      "createInitialUser only runs on an empty deployment; a user already exists."
    )
  }
  return await ctx.db.insert("users", {
    wcaUserId: args.wcaUserId,
    name: args.name,
    email: args.email,
  })
}

export async function seedInitialData(
  ctx: MutationCtx
): Promise<SeedInitialDataResult> {
  for (const teamName of Object.values(TEAM_NAMES)) {
    await ensureTeamByName(ctx, teamName)
  }
  await ensureDefaultTaskLabels(ctx)

  const [users, memberships] = await Promise.all([
    collectAll(ctx, "users"),
    collectAll(ctx, "teamMemberships"),
  ])

  if (users.length !== 1 || memberships.length > 0) {
    return {
      teamsEnsured: Object.values(TEAM_NAMES).length,
      labelsEnsured: DEFAULT_TASK_LABELS.length,
      directorAssigned: false,
      directorUserId: null,
    }
  }

  const soleUser = users[0]
  const directorsTeamId = await ensureTeamByName(ctx, TEAM_NAMES.DIRECTORS)
  await addTeamMember(ctx, directorsTeamId, soleUser._id)

  return {
    teamsEnsured: Object.values(TEAM_NAMES).length,
    labelsEnsured: DEFAULT_TASK_LABELS.length,
    directorAssigned: true,
    directorUserId: soleUser._id,
  }
}
