import { ConvexError } from "convex/values"
import type { TaskIntegrationId } from "@/convex/plugins/core/types"
import type {
  BackendIntegrationPlugin,
  TaskIntegrationDefinition,
} from "@/convex/plugins/core/integrationTypes"
import { buildTaskIntegrationDefinitions } from "@/convex/plugins/core/integrationTypes"
import { INTEGRATION_PLUGINS } from "@/convex/plugins/registry"

const integrationById = new Map<TaskIntegrationId, TaskIntegrationDefinition>()

for (const plugin of INTEGRATION_PLUGINS) {
  for (const integration of buildTaskIntegrationDefinitions(plugin)) {
    integrationById.set(integration.id, integration)
  }
}

export function listBackendPlugins(): readonly BackendIntegrationPlugin[] {
  return INTEGRATION_PLUGINS
}

export function toIntegrationDefinitionMeta(
  definition: TaskIntegrationDefinition
) {
  return {
    id: definition.id,
    label: definition.label,
    pluginId: definition.pluginId,
  }
}

export function getIntegrationDefinition(
  id: TaskIntegrationId
): TaskIntegrationDefinition {
  const definition = integrationById.get(id)
  if (definition === undefined) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: `Unknown integration id: ${id}`,
    })
  }
  return definition
}

export function listIntegrationDefinitions(): TaskIntegrationDefinition[] {
  return [...integrationById.values()]
}
