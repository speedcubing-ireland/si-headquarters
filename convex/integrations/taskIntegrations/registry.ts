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
  return TASK_INTEGRATION_IDS.flatMap((id): TaskIntegrationDefinition[] => {
    const definition = TASK_INTEGRATION_DEFINITIONS[id]
    const base = {
      id,
      label: definition.label,
      pluginId: definition.pluginId,
      requiredResources: definition.requiredResources,
    }
    if (definition.kind === "link") {
      return definition.pluginId === plugin.id
        ? [{ ...base, kind: "link" }]
        : []
    }
    const run = plugin.taskIntegrationRunners?.[id]
    if (run === undefined) {
      return []
    }
    if (definition.pluginId !== plugin.id) {
      throw new Error(
        `Task integration ${id} belongs to plugin ${definition.pluginId}, not ${plugin.id}.`
      )
    }
    return [{ ...base, kind: "run", run }]
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
    kind: definition.kind,
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

/**
 * Looks up an integration that can be run. Link integrations have no runner, so
 * asking to run one is a bad request rather than a missing id.
 */
export function getRunnableIntegrationDefinition(
  id: TaskIntegrationId
): Extract<TaskIntegrationDefinition, { kind: "run" }> {
  const definition = getIntegrationDefinition(id)
  if (definition.kind !== "run") {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Integration ${id} is a link and cannot be run.`,
    })
  }
  return definition
}
