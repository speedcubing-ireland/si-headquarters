import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { TEAM_NAMES, type TeamName } from "@/convex/permissions/shared"
import { addTeamMember, ensureTeamByName } from "@/convex/teams/model"
import type { TaskKind } from "@/convex/tasks/kind"
import type {
  TaskStatus,
  TaskStatusIntent,
} from "@/convex/tasks/status/resolver"
import type { TaskIntegrationId } from "@/convex/plugins/core/validators"
import { attachConfiguredIntegrationsForTask } from "@/convex/plugins/core/taskTemplateIntegrations"
import {
  deriveTaskRootContextFromParent,
  taskRootPatch,
} from "@/convex/tasks/hierarchy"
import type { TestConvex } from "convex-test"
import type schema from "@/convex/schema"

export interface SeedTaskInput {
  name?: string
  parent: Doc<"tasks">["parent"]
  order: string
  kind?: TaskKind
  status?: TaskStatus
  integrationIds?: readonly TaskIntegrationId[]
}

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

export async function seedDirectorUser(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await ctx.db.insert("users", {})
  const teamId = await ensureTeamByName(ctx, TEAM_NAMES.DIRECTORS)
  await addTeamMember(ctx, teamId, userId)
  return userId
}

export async function insertCompetitionPhase(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  name: string,
  sortKey: string,
  color: Doc<"phases">["color"] = "gray"
): Promise<Id<"phases">> {
  return await ctx.db.insert("phases", {
    name,
    owner: { type: "competitions", id: competitionId },
    sortKey,
    color,
  })
}

export async function insertSeedTask(
  ctx: MutationCtx,
  seed: SeedTaskInput
): Promise<Id<"tasks">> {
  const status = seed.status ?? "backlog"
  const statusIntent: TaskStatusIntent = { type: "manual", status }

  const taskId = await ctx.db.insert("tasks", {
    name: seed.name ?? `Task ${seed.order}`,
    description: null,
    parent: seed.parent,
    ...taskRootPatch(await deriveTaskRootContextFromParent(ctx, seed.parent)),
    order: seed.order,
    assigneeIds: null,
    owner: null,
    dueDate: null,
    kind: seed.kind ?? "standard",
    status,
    statusIntent,
  })
  await attachConfiguredIntegrationsForTask(ctx, taskId, {
    integrationIds: seed.integrationIds,
  })
  return taskId
}
