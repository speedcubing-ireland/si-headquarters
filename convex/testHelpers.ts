import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { TEAM_NAMES, type TeamName } from "@/convex/permissions/shared"
import { addTeamMember, ensureTeamByName } from "@/convex/teams/model"
import type { TaskKind } from "@/convex/tasks/kind"
import type {
  TaskStatus,
  TaskStatusIntent,
} from "@/convex/tasks/status/resolver"
import type { TaskIntegrationId } from "@/convex/integrations/taskIntegrations/validators"
import { attachConfiguredIntegrationsForTask } from "@/convex/integrations/taskIntegrations/templates"
import {
  deriveTaskRootContextFromParent,
  taskRootPatch,
} from "@/convex/tasks/hierarchy"
import type { TestConvex } from "convex-test"
import type schema from "@/convex/schema"
import { standardCompetitionTemplate } from "@/convex/templates/registry"

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
  color: Doc<"phases">["color"] = "gray",
  templateKey?: string
): Promise<Id<"phases">> {
  return await ctx.db.insert("phases", {
    name,
    owner: { type: "competitions", id: competitionId },
    sortKey,
    color,
    templateKey,
  })
}

export async function insertBlankProject(
  ctx: MutationCtx,
  scope: Doc<"projects">["scope"] = { type: "global" }
): Promise<Id<"projects">> {
  return await ctx.db.insert("projects", {
    name: "Sample Project",
    description: null,
    scope,
    leadUserId: null,
    phaseId: null,
    status: "planning",
  })
}

export async function insertProjectPhase(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  name: string,
  sortKey: string,
  color: Doc<"phases">["color"] = "gray"
): Promise<Id<"phases">> {
  return await ctx.db.insert("phases", {
    name,
    owner: { type: "projects", id: projectId },
    sortKey,
    color,
  })
}

export async function linkOwnerDiscordChannel(
  ctx: MutationCtx,
  taskId: Id<"tasks">
): Promise<void> {
  const task = await ctx.db.get("tasks", taskId)
  if (task === null) throw new Error("Task not found")
  await ctx.db.insert("objectLinkedResources", {
    object: task.root,
    resourceType: "discordChannel",
    resourceKey: "default",
    data: {
      resourceType: "discordChannel",
      channelId: "comp-channel-1",
      channelName: "spring-open",
      guildId: "guild-1",
    },
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

/**
 * The standard competition template's phases, in order, as the resolver creates
 * them. Derived from the registry so a template change surfaces as the tests
 * that actually care rather than a stale hardcoded list.
 */
export const TEMPLATE_PHASES = standardCompetitionTemplate.phases.map(
  (phase, index) => ({
    key: phase.key,
    name: phase.name,
    sortKey: `a${String(index)}`,
  })
)

export type TemplatePhaseKey = (typeof TEMPLATE_PHASES)[number]["key"]

/**
 * A competition with the standard template's phases, as the WCA phase sync
 * expects to find it.
 */
export async function seedTemplateCompetition(
  t: TestConvex<typeof schema>,
  options: {
    /** Template phase to start in; omit for no phase. */
    startingPhase?: TemplatePhaseKey
    /** Phases to leave out, to model a competition someone edited. */
    omit?: readonly TemplatePhaseKey[]
    /** WCA competition id to link, or omit to leave it unlinked. */
    wcaCompetitionId?: string
  } = {}
): Promise<{ competitionId: Id<"competitions"> }> {
  return await t.run(async (ctx) => {
    const competitionId = await insertBlankCompetition(ctx)
    if (options.wcaCompetitionId !== undefined) {
      await ctx.db.patch("competitions", competitionId, {
        wcaCompetitionId: options.wcaCompetitionId,
      })
    }

    const phaseIdByKey = new Map<string, Id<"phases">>()
    for (const phase of TEMPLATE_PHASES) {
      if (options.omit?.includes(phase.key) === true) continue
      phaseIdByKey.set(
        phase.key,
        await insertCompetitionPhase(
          ctx,
          competitionId,
          phase.name,
          phase.sortKey,
          "gray",
          phase.key
        )
      )
    }

    if (options.startingPhase !== undefined) {
      await ctx.db.patch("competitions", competitionId, {
        phaseId: phaseIdByKey.get(options.startingPhase) ?? null,
      })
    }

    return { competitionId }
  })
}

/** Every phase of a competition, in phase order. */
export async function phasesForCompetition(
  t: TestConvex<typeof schema>,
  competitionId: Id<"competitions">
): Promise<Doc<"phases">[]> {
  return await t.run(async (ctx) =>
    ctx.db
      .query("phases")
      .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
        q.eq("owner.type", "competitions").eq("owner.id", competitionId)
      )
      .collect()
  )
}

/** One backlog task in each of a competition's phases. */
export async function seedTaskPerPhase(
  t: TestConvex<typeof schema>,
  competitionId: Id<"competitions">
): Promise<void> {
  const phases = await phasesForCompetition(t, competitionId)
  await t.run(async (ctx) => {
    for (const [index, phase] of phases.entries()) {
      await insertSeedTask(ctx, {
        parent: { type: "phases", id: phase._id },
        order: `a${String(index)}`,
      })
    }
  })
}
