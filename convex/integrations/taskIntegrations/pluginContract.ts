import type { Id } from "@/convex/_generated/dataModel"
import type { ActionCtx } from "@/convex/_generated/server"
import type {
  IntegrationServiceId,
  PluginId,
} from "@/convex/integrations/constants"
import type {
  LinkedResourceData,
  LinkedResourceType,
} from "@/convex/integrations/validators"
import type {
  TaskIntegrationId,
  TaskIntegrationOutput,
  TaskIntegrationRunInput,
  TaskIntegrationStatus,
} from "@/convex/integrations/taskIntegrations/validators"
import type { RequiredStringConvexEnvName } from "@/convex/envTypes"
import type { TaskNotificationEnricher } from "@/convex/notifications/types"

export interface TaskIntegrationRunResult {
  status: TaskIntegrationStatus
  lastMessage: string | null
  output: TaskIntegrationOutput
}

export type TaskIntegrationRunner = (
  ctx: ActionCtx,
  input: TaskIntegrationRunContext
) => Promise<TaskIntegrationRunResult>

export interface TaskIntegrationRunContext {
  competitionId: Id<"competitions">
  competitionName: string
  integrationRowId: Id<"taskIntegrations">
  integrationId: TaskIntegrationId
  resources: Partial<Record<string, LinkedResourceData>>
  input: TaskIntegrationRunInput
}

export interface TaskIntegrationDefinition {
  id: TaskIntegrationId
  label: string
  pluginId: PluginId
  requiredResources: readonly {
    resourceType: LinkedResourceType
    resourceKey: string
  }[]
  run: TaskIntegrationRunner
}

export interface BackendIntegrationPlugin {
  id: PluginId
  service?: IntegrationServiceId
  env?: readonly RequiredStringConvexEnvName[]
  enrichTaskNotification?: TaskNotificationEnricher
  taskIntegrationRunners?: Partial<
    Record<TaskIntegrationId, TaskIntegrationRunner>
  >
}
