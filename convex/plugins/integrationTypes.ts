import type { Id } from "@/convex/_generated/dataModel"
import type { ActionCtx } from "@/convex/_generated/server"
import type {
  CompetitionResourceData,
  CompetitionResourceType,
  LoadedRunContext,
  TaskIntegrationId,
  TaskIntegrationRunInput,
  TaskIntegrationStatus,
  taskIntegrationOutput,
} from "@/convex/plugins/core/validators"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/plugins/core/constants"
import type { Infer } from "convex/values"

export type TaskIntegrationOutput = Infer<typeof taskIntegrationOutput>
export type { LoadedRunContext }

export interface IntegrationRunResult {
  status: TaskIntegrationStatus
  lastMessage: string | null
  output: TaskIntegrationOutput
}

export interface RunContext {
  competitionId: Id<"competitions">
  competitionName: string
  integrationRowId: Id<"taskIntegrations">
  integrationId: TaskIntegrationId
  resources: Partial<Record<string, CompetitionResourceData>>
  input: TaskIntegrationRunInput
}

export function getRunResource(
  resources: Partial<Record<string, CompetitionResourceData>>,
  resourceType: CompetitionResourceType,
  resourceKey: string
): CompetitionResourceData {
  const data = resources[`${resourceType}:${resourceKey}`]
  if (data === undefined) {
    throw new Error(
      `Missing ${resourceType} resource '${resourceKey}' for this competition.`
    )
  }
  return data
}

function assertMatchingResource<
  ResourceType extends CompetitionResourceData["resourceType"],
>(
  data: CompetitionResourceData,
  resourceType: ResourceType
): asserts data is Extract<CompetitionResourceData, { resourceType: ResourceType }> {
  if (data.resourceType !== resourceType) {
    throw new Error(
      `Linked ${resourceType} resource has an unexpected shape.`
    )
  }
}

export function requireRunResource<
  ResourceType extends CompetitionResourceData["resourceType"],
>(
  run: RunContext,
  resourceType: ResourceType,
  resourceKey = defaultResourceKey(resourceType)
): Extract<CompetitionResourceData, { resourceType: ResourceType }> {
  const data = getRunResource(run.resources, resourceType, resourceKey)
  assertMatchingResource(data, resourceType)
  return data
}

export interface TaskIntegrationDefinition {
  id: TaskIntegrationId
  label: string
  pluginId: string
  requiredResources: readonly {
    resourceType: CompetitionResourceType
    resourceKey: string
  }[]
  run: (ctx: ActionCtx, input: RunContext) => Promise<IntegrationRunResult>
}

export interface BackendIntegrationPlugin {
  id: string
  service?: string
  env?: readonly string[]
  taskIntegrations?: readonly TaskIntegrationDefinition[]
}

export function defaultResourceKey(
  resourceType: CompetitionResourceType
): string {
  return DEFAULT_RESOURCE_KEYS[resourceType]
}
