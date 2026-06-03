import { ConvexError } from "convex/values"
import type { Infer } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import type { ActionCtx } from "@/convex/_generated/server"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/plugins/core/constants"
import type { RequiredStringConvexEnvName } from "@/convex/envTypes"
import {
  TASK_INTEGRATION_DEFINITIONS,
  TASK_INTEGRATION_IDS,
  type IntegrationServiceId,
  type PluginId,
} from "@/convex/plugins/core/constants"
import type {
  CompetitionResourceData,
  CompetitionResourceType,
  LoadedRunContext,
  TaskIntegrationId,
  TaskIntegrationRunInput,
  TaskIntegrationStatus,
  taskIntegrationOutput,
} from "@/convex/plugins/core/validators"

export type TaskIntegrationOutput = Infer<typeof taskIntegrationOutput>
export type { LoadedRunContext }

export interface IntegrationRunResult {
  status: TaskIntegrationStatus
  lastMessage: string | null
  output: TaskIntegrationOutput
}

export type TaskIntegrationRunner = (
  ctx: ActionCtx,
  input: RunContext
) => Promise<IntegrationRunResult>

export interface RunContext {
  competitionId: Id<"competitions">
  competitionName: string
  integrationRowId: Id<"taskIntegrations">
  integrationId: TaskIntegrationId
  resources: Partial<Record<string, CompetitionResourceData>>
  input: TaskIntegrationRunInput
}

export function requireRunResource(
  run: RunContext,
  resourceType: "googleSheet",
  resourceKey?: string
): Extract<CompetitionResourceData, { resourceType: "googleSheet" }>
export function requireRunResource(
  run: RunContext,
  resourceType: "wcaCompetition",
  resourceKey?: string
): Extract<CompetitionResourceData, { resourceType: "wcaCompetition" }>
export function requireRunResource(
  run: RunContext,
  resourceType: "discordChannel",
  resourceKey?: string
): Extract<CompetitionResourceData, { resourceType: "discordChannel" }>
export function requireRunResource(
  run: RunContext,
  resourceType: CompetitionResourceType,
  resourceKey = defaultResourceKey(resourceType)
): CompetitionResourceData {
  const data = run.resources[`${resourceType}:${resourceKey}`]
  if (data === undefined) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: `Missing ${resourceType} resource '${resourceKey}' for this competition.`,
    })
  }
  if (data.resourceType !== resourceType) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: `Linked ${resourceType} resource has an unexpected shape.`,
    })
  }
  return data
}

export interface TaskIntegrationDefinition {
  id: TaskIntegrationId
  label: string
  pluginId: PluginId
  requiredResources: readonly {
    resourceType: CompetitionResourceType
    resourceKey: string
  }[]
  run: TaskIntegrationRunner
}

export interface BackendIntegrationPlugin {
  id: PluginId
  service?: IntegrationServiceId
  env?: readonly RequiredStringConvexEnvName[]
  taskIntegrationRunners?: Partial<
    Record<TaskIntegrationId, TaskIntegrationRunner>
  >
}

export function buildTaskIntegrationDefinitions(
  plugin: BackendIntegrationPlugin
): TaskIntegrationDefinition[] {
  return TASK_INTEGRATION_IDS.flatMap((id) => {
    const run = plugin.taskIntegrationRunners?.[id]
    if (run === undefined) {
      return []
    }
    const definition = TASK_INTEGRATION_DEFINITIONS[id]
    if (definition.pluginId !== plugin.id) {
      throw new Error(
        `Task integration ${id} belongs to plugin ${definition.pluginId}, not ${plugin.id}.`
      )
    }
    return {
      id,
      label: definition.label,
      pluginId: definition.pluginId,
      requiredResources: definition.requiredResources,
      run,
    }
  })
}

export function defaultResourceKey(
  resourceType: CompetitionResourceType
): string {
  return DEFAULT_RESOURCE_KEYS[resourceType]
}
