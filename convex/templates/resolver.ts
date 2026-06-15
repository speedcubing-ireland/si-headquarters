import { ConvexError } from "convex/values"
import { generateNKeysBetween } from "fractional-indexing"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { addIsoDays } from "@/convex/competitions/dates"
import { getTeamByName } from "@/convex/teams/model"
import { upsertObjectLinkedResource } from "@/convex/integrations/objectResourcesModel"
import { attachConfiguredIntegrationsForTask } from "@/convex/integrations/taskIntegrations/templates"
import {
  ensureDefaultTaskLabels,
  ensureTaskLabelByCode,
} from "@/convex/tasks/labels/model"
import {
  deriveTaskRootContextFromParent,
  taskRootPatch,
} from "@/convex/tasks/hierarchy"
import { activatePhaseBacklogTasks } from "@/convex/tasks/status/recompute"
import { listPhasesForOwner } from "@/convex/phases/model"
import {
  getCompetitionTemplate,
  type CompetitionTemplateDefinition,
  type CompetitionTemplateTaskSpec,
} from "@/convex/templates/registry"
import type {
  TemplateVariables,
  TemplateVariableValue,
} from "@/convex/templates/validators"

type TaskOwnerInput = CompetitionTemplateTaskSpec["owner"]
type TaskAssigneesInput = CompetitionTemplateTaskSpec["assignees"]
type ReviewerInput = NonNullable<
  CompetitionTemplateTaskSpec["reviewers"]
>[number]

type TemplateCompetitionInput = Pick<
  Doc<"competitions">,
  "name" | "description" | "compDates" | "people"
>

async function getExistingCompetitionTemplateBlockReason(
  ctx: MutationCtx,
  competitionId: Id<"competitions">
): Promise<string | null> {
  const phases = await listPhasesForOwner(ctx, {
    type: "competitions",
    id: competitionId,
  })
  if (phases.length > 0) {
    return "Remove all phases before applying a template."
  }

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_root_type_and_root_id", (q) =>
      q.eq("root.type", "competitions").eq("root.id", competitionId)
    )
    .take(1)
  if (tasks.length > 0) {
    return "Remove all tasks before applying a template."
  }

  return null
}

function userFacingError(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message })
}

function getTemplateOrThrow(
  templateKey: string
): CompetitionTemplateDefinition {
  const template = getCompetitionTemplate(templateKey)
  if (template === null) {
    userFacingError("Competition template not found.")
  }
  return template
}

function isMissing(value: TemplateVariableValue | undefined): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
}

function normalizeVariables(
  template: CompetitionTemplateDefinition,
  input: TemplateVariables
): TemplateVariables {
  const definitions = template.variables ?? []
  const normalized: TemplateVariables = { ...input }

  for (const variable of definitions) {
    if (!(variable.key in input) && variable.defaultValue !== undefined) {
      normalized[variable.key] = variable.defaultValue
    }

    const value = normalized[variable.key]
    if (variable.required === true && isMissing(value)) {
      userFacingError(`${variable.label} is required.`)
    }
    if (isMissing(value)) continue

    const type = Array.isArray(value) ? "array" : typeof value
    const expected =
      variable.type === "number"
        ? "number"
        : variable.type === "boolean"
          ? "boolean"
          : variable.type === "users"
            ? "array"
            : "string"
    if (type !== expected) {
      userFacingError(`${variable.label} has the wrong value type.`)
    }
  }

  return normalized
}

function resolveRelativeDate(
  competition: TemplateCompetitionInput,
  variables: TemplateVariables,
  spec: CompetitionTemplateTaskSpec["dueDate"]
): string | null {
  if (spec === undefined || spec === null) return null

  let anchor: TemplateVariableValue | undefined
  if (spec.anchor.type === "competitionStart")
    anchor = competition.compDates.from
  if (spec.anchor.type === "competitionEnd") {
    anchor = competition.compDates.to ?? competition.compDates.from
  }
  if (spec.anchor.type === "variable") anchor = variables[spec.anchor.key]

  if (typeof anchor !== "string" || anchor.length === 0) return null
  return addIsoDays(anchor, spec.offsetDays ?? 0)
}

function roleUserId(
  competition: TemplateCompetitionInput,
  role: "compLead" | "leadDelegate"
) {
  return competition.people[role]
}

async function requireExistingUser(
  ctx: MutationCtx,
  userId: Id<"users"> | null,
  label: string
): Promise<Id<"users"> | null> {
  if (userId === null) return null
  const user = await ctx.db.get("users", userId)
  if (user === null) {
    userFacingError(`${label} references a user that no longer exists.`)
  }
  return userId
}

function isTemplateUserId(
  value: TemplateVariableValue | undefined
): value is Id<"users"> {
  return typeof value === "string" && value.length > 0
}

async function requireExistingUserFromTemplateValue(
  ctx: MutationCtx,
  value: TemplateVariableValue | undefined,
  label: string
): Promise<Id<"users"> | null> {
  if (!isTemplateUserId(value)) return null
  const user = await ctx.db.get("users", value)
  if (user === null) {
    userFacingError(`${label} references a user that no longer exists.`)
  }
  return value
}

async function resolveTeamRef(ctx: MutationCtx, teamName: string) {
  const team = await getTeamByName(ctx, teamName)
  if (team === null) {
    userFacingError(`Team "${teamName}" must exist before using this template.`)
  }
  return { type: "teams" as const, id: team._id }
}

async function resolveOwner(
  ctx: MutationCtx,
  competition: TemplateCompetitionInput,
  variables: TemplateVariables,
  owner: TaskOwnerInput
): Promise<Doc<"tasks">["owner"]> {
  if (owner === undefined || owner === null) return null
  if (owner.type === "teamName")
    return await resolveTeamRef(ctx, owner.teamName)
  if (owner.type === "competitionRole") {
    const userId = await requireExistingUser(
      ctx,
      roleUserId(competition, owner.role),
      owner.role
    )
    return userId === null ? null : { type: "users", id: userId }
  }

  const value = variables[owner.key]
  if (typeof value !== "string" || value.length === 0) return null
  const team = await getTeamByName(ctx, value)
  if (team !== null) return { type: "teams", id: team._id }
  const userId = await requireExistingUserFromTemplateValue(
    ctx,
    value,
    owner.key
  )
  if (userId === null) return null
  return {
    type: "users",
    id: userId,
  }
}

async function resolveAssignees(
  ctx: MutationCtx,
  competition: TemplateCompetitionInput,
  variables: TemplateVariables,
  assignees: TaskAssigneesInput
): Promise<Doc<"tasks">["assigneeIds"]> {
  if (assignees === undefined || assignees === null) return null
  if (assignees === "assignable") return "assignable"
  if (assignees.type === "competitionOrganisers") {
    return competition.people.organisers.length > 0
      ? competition.people.organisers
      : null
  }
  if (assignees.type === "competitionRole") {
    const userId = await requireExistingUser(
      ctx,
      roleUserId(competition, assignees.role),
      assignees.role
    )
    return userId === null ? null : [userId]
  }

  const value = variables[assignees.key]
  if (typeof value === "string" && value.length > 0) {
    const userId = await requireExistingUserFromTemplateValue(
      ctx,
      value,
      assignees.key
    )
    return userId === null ? null : [userId]
  }
  if (Array.isArray(value)) {
    const ids = await Promise.all(
      value.map((entry) =>
        requireExistingUserFromTemplateValue(ctx, entry, assignees.key)
      )
    )
    return ids.filter((id): id is Id<"users"> => id !== null)
  }
  return null
}

async function resolveReviewer(
  ctx: MutationCtx,
  competition: TemplateCompetitionInput,
  variables: TemplateVariables,
  reviewer: ReviewerInput
) {
  if (reviewer.type === "teamName") {
    return await resolveTeamRef(ctx, reviewer.teamName)
  }
  if (reviewer.type === "competitionRole") {
    const userId = await requireExistingUser(
      ctx,
      roleUserId(competition, reviewer.role),
      reviewer.role
    )
    return userId === null ? null : { type: "users" as const, id: userId }
  }

  const resolved = await requireExistingUserFromTemplateValue(
    ctx,
    variables[reviewer.key],
    reviewer.key
  )
  return resolved === null ? null : { type: "users" as const, id: resolved }
}

function assertUniqueTaskKeys(
  tasks: readonly CompetitionTemplateTaskSpec[],
  seen = new Set<string>()
) {
  for (const task of tasks) {
    if (seen.has(task.key)) {
      userFacingError(`Duplicate template task key "${task.key}".`)
    }
    seen.add(task.key)
    assertUniqueTaskKeys(task.subtasks ?? [], seen)
  }
}

async function insertTaskTree({
  ctx,
  competition,
  labelIdsByCode,
  parent,
  taskIdsByKey,
  tasks,
  variables,
}: {
  ctx: MutationCtx
  competition: TemplateCompetitionInput
  labelIdsByCode: Map<string, Id<"taskLabels">>
  parent: Doc<"tasks">["parent"]
  taskIdsByKey: Map<string, Id<"tasks">>
  tasks: readonly CompetitionTemplateTaskSpec[]
  variables: TemplateVariables
}) {
  const orderKeys = generateNKeysBetween(null, null, tasks.length)

  for (const [index, task] of tasks.entries()) {
    const status = task.status ?? "backlog"
    const taskId = await ctx.db.insert("tasks", {
      name: task.name,
      description: task.description ?? null,
      parent,
      ...taskRootPatch(await deriveTaskRootContextFromParent(ctx, parent)),
      order: orderKeys[index],
      assigneeIds: await resolveAssignees(
        ctx,
        competition,
        variables,
        task.assignees
      ),
      owner: await resolveOwner(ctx, competition, variables, task.owner),
      dueDate: resolveRelativeDate(competition, variables, task.dueDate),
      kind: task.kind ?? "standard",
      status,
      statusIntent: { type: "manual", status },
    })
    taskIdsByKey.set(task.key, taskId)

    for (const labelCode of task.labels ?? []) {
      const labelId =
        labelIdsByCode.get(labelCode) ??
        (await ensureTaskLabelByCode(ctx, labelCode))
      labelIdsByCode.set(labelCode, labelId)
      await ctx.db.insert("taskLabelAssignments", { taskId, labelId })
    }

    for (const reviewerSpec of task.reviewers ?? []) {
      const reviewer = await resolveReviewer(
        ctx,
        competition,
        variables,
        reviewerSpec
      )
      if (reviewer === null) continue
      await ctx.db.insert("taskReviewers", {
        taskId,
        reviewer,
        approvedAt: null,
        approvedBy: null,
      })
    }

    await attachConfiguredIntegrationsForTask(ctx, taskId, {
      integrationIds: task.integrationIds,
    })

    await insertTaskTree({
      ctx,
      competition,
      labelIdsByCode,
      parent: { type: "tasks", id: taskId },
      taskIdsByKey,
      tasks: task.subtasks ?? [],
      variables,
    })
  }
}

async function upsertTemplateLinkedResource(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  resource: NonNullable<
    CompetitionTemplateDefinition["linkedResources"]
  >[number]
) {
  await upsertObjectLinkedResource(ctx, {
    object: { type: "competitions" as const, id: competitionId },
    resourceType: resource.resourceType,
    resourceKey: resource.resourceKey,
    data: resource.data,
  })
}

async function applyCompetitionTemplateStructure(
  ctx: MutationCtx,
  args: {
    templateKey: string
    variables: TemplateVariables
    competitionId: Id<"competitions">
    competition: TemplateCompetitionInput
  }
): Promise<Id<"competitions">> {
  const template = getTemplateOrThrow(args.templateKey)
  const variables = normalizeVariables(template, args.variables)
  const phaseKeys = new Set(template.phases.map((phase) => phase.key))
  if (
    template.initialPhaseKey !== undefined &&
    !phaseKeys.has(template.initialPhaseKey)
  ) {
    userFacingError("Initial phase key does not match a template phase.")
  }

  for (const phase of template.phases) {
    assertUniqueTaskKeys(phase.tasks ?? [])
  }

  await ensureDefaultTaskLabels(ctx)

  const { competitionId } = args
  const phaseIdsByKey = new Map<string, Id<"phases">>()
  const taskIdsByKey = new Map<string, Id<"tasks">>()
  const labelIdsByCode = new Map<string, Id<"taskLabels">>()
  const phaseOrderKeys = generateNKeysBetween(
    null,
    null,
    template.phases.length
  )

  for (const [index, phase] of template.phases.entries()) {
    const phaseId = await ctx.db.insert("phases", {
      name: phase.name,
      owner: { type: "competitions", id: competitionId },
      sortKey: phaseOrderKeys[index],
      color: phase.color,
    })
    phaseIdsByKey.set(phase.key, phaseId)
    await insertTaskTree({
      ctx,
      competition: args.competition,
      labelIdsByCode,
      parent: { type: "phases", id: phaseId },
      taskIdsByKey,
      tasks: phase.tasks ?? [],
      variables,
    })
  }

  for (const phase of template.phases) {
    for (const task of flattenTasks(phase.tasks ?? [])) {
      const blockedTaskId = taskIdsByKey.get(task.key)
      if (blockedTaskId === undefined) continue
      for (const blockingKey of task.blockedBy ?? []) {
        const blockingTaskId = taskIdsByKey.get(blockingKey)
        if (blockingTaskId === undefined) {
          userFacingError(`Unknown blocking task key "${blockingKey}".`)
        }
        await ctx.db.insert("taskBlockers", {
          blockedTaskId,
          blockingTaskId,
        })
      }
    }
  }

  for (const resource of template.linkedResources ?? []) {
    await upsertTemplateLinkedResource(ctx, competitionId, resource)
  }

  const initialPhaseId =
    template.initialPhaseKey === undefined
      ? null
      : (phaseIdsByKey.get(template.initialPhaseKey) ?? null)
  if (initialPhaseId !== null) {
    await ctx.db.patch("competitions", competitionId, {
      phaseId: initialPhaseId,
    })
    await activatePhaseBacklogTasks(ctx, initialPhaseId)
  }

  return competitionId
}

export async function applyCompetitionTemplate(
  ctx: MutationCtx,
  args: {
    templateKey: string
    variables: TemplateVariables
    competitionId?: Id<"competitions">
    competition?: TemplateCompetitionInput
  }
): Promise<Id<"competitions">> {
  let competitionId: Id<"competitions">
  let competition: TemplateCompetitionInput

  if (args.competitionId !== undefined) {
    const existing = await ctx.db.get("competitions", args.competitionId)
    if (existing === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found.",
      })
    }

    const blockReason = await getExistingCompetitionTemplateBlockReason(
      ctx,
      args.competitionId
    )
    if (blockReason !== null) {
      userFacingError(blockReason)
    }

    competitionId = args.competitionId
    competition = {
      name: existing.name,
      description: existing.description,
      compDates: existing.compDates,
      people: existing.people,
    }
  } else {
    if (args.competition === undefined) {
      userFacingError("Competition details are required.")
    }
    competition = args.competition
    competitionId = await ctx.db.insert("competitions", {
      name: competition.name,
      description: competition.description,
      people: competition.people,
      compDates: competition.compDates,
      phaseId: null,
    })
  }

  return await applyCompetitionTemplateStructure(ctx, {
    templateKey: args.templateKey,
    variables: args.variables,
    competitionId,
    competition,
  })
}

function flattenTasks(
  tasks: readonly CompetitionTemplateTaskSpec[]
): CompetitionTemplateTaskSpec[] {
  const result: CompetitionTemplateTaskSpec[] = []
  for (const task of tasks) {
    result.push(task)
    result.push(...flattenTasks(task.subtasks ?? []))
  }
  return result
}
