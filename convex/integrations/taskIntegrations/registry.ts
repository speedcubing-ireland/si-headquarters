import { ConvexError } from "convex/values"
import {
  TASK_INTEGRATION_DEFINITIONS,
  TASK_INTEGRATION_IDS,
} from "@/convex/integrations/taskIntegrations/constants"
import type {
  BackendIntegrationPlugin,
  TaskIntegrationDefinition,
} from "@/convex/integrations/taskIntegrations/pluginContract"
import type { TaskIntegrationId } from "@/convex/integrations/taskIntegrations/validators"
import { BACKEND_PLUGINS } from "@/convex/plugins/registry"

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

const integrationById = new Map<TaskIntegrationId, TaskIntegrationDefinition>()

for (const plugin of BACKEND_PLUGINS) {
  for (const integration of buildTaskIntegrationDefinitions(plugin)) {
    if (integrationById.has(integration.id)) {
      throw new Error(`Duplicate task integration id: ${integration.id}`)
    }
    integrationById.set(integration.id, integration)
  }
}

export function listIntegrationDefinitions(): TaskIntegrationDefinition[] {
  return [...integrationById.values()]
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
