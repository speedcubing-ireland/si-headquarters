import { ConvexError } from "convex/values"
import { BACKEND_PLUGINS } from "@/convex/plugins/registry"
import { PROJECT_WORKFLOW_IDS } from "@/convex/projectWorkflows/constants"
import type { ProjectWorkflowDefinition } from "@/convex/projectWorkflows/types"
import type { ProjectWorkflowId } from "@/convex/projectWorkflows/validators"

const definitionById = new Map<ProjectWorkflowId, ProjectWorkflowDefinition>()

for (const plugin of BACKEND_PLUGINS) {
  for (const definition of plugin.projectWorkflowDefinitions ?? []) {
    if (definition.pluginId !== plugin.id) {
      throw new Error(
        `Project workflow ${definition.id} belongs to plugin ${definition.pluginId}, not ${plugin.id}.`
      )
    }
    if (definitionById.has(definition.id)) {
      throw new Error(`Duplicate project workflow id: ${definition.id}`)
    }
    definitionById.set(definition.id, definition)
  }
}

for (const id of PROJECT_WORKFLOW_IDS) {
  if (!definitionById.has(id)) {
    throw new Error(`Missing project workflow registration: ${id}`)
  }
}

export function getProjectWorkflowDefinition(
  id: ProjectWorkflowId
): ProjectWorkflowDefinition {
  const definition = definitionById.get(id)
  if (definition === undefined) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: `Unknown project workflow id: ${id}`,
    })
  }
  return definition
}

export function listProjectWorkflowDefinitions(): ProjectWorkflowDefinition[] {
  return [...definitionById.values()]
}

export function toProjectWorkflowDefinitionMeta(
  definition: ProjectWorkflowDefinition
) {
  return {
    id: definition.id,
    pluginId: definition.pluginId,
    label: definition.label,
    description: definition.description,
    defaultConfig: definition.defaultConfig,
    schedule: definition.schedule,
  }
}
