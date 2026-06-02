import type { TaskIntegrationId } from "@/convex/plugins/core/types"
import type {
  BackendIntegrationPlugin,
  TaskIntegrationDefinition,
} from "@/convex/plugins/integrationTypes"
import { INTEGRATION_PLUGINS } from "@/convex/plugins/registry"

const integrationById = new Map<TaskIntegrationId, TaskIntegrationDefinition>()

for (const plugin of INTEGRATION_PLUGINS) {
  for (const integration of plugin.taskIntegrations ?? []) {
    integrationById.set(integration.id, integration)
  }
}

export function listBackendPlugins(): readonly BackendIntegrationPlugin[] {
  return INTEGRATION_PLUGINS
}

export function getIntegrationDefinition(
  id: TaskIntegrationId
): TaskIntegrationDefinition {
  const definition = integrationById.get(id)
  if (definition === undefined) {
    throw new Error(`Unknown integration id: ${id}`)
  }
  return definition
}

export function listIntegrationDefinitions(): TaskIntegrationDefinition[] {
  return [...integrationById.values()]
}
