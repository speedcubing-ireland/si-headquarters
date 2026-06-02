import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { TASK_INTEGRATION_IDS } from "@/convex/plugins/core/constants"
import { insertTaskIntegrationIfMissing } from "@/convex/plugins/core/taskIntegrationRows"
import type { TaskIntegrationId } from "@/convex/plugins/core/validators"
import { getIntegrationDefinition } from "@/convex/plugins/core/resolvePlugins"

export interface TaskSpecWithIntegrations {
  integrationIds?: readonly TaskIntegrationId[]
}

const integrationIdSet = new Set<string>(TASK_INTEGRATION_IDS)

export function resolveTaskSpecIntegrationIds(
  spec: TaskSpecWithIntegrations
): TaskIntegrationId[] {
  if (spec.integrationIds === undefined) {
    return []
  }
  const ids: TaskIntegrationId[] = []
  for (const id of spec.integrationIds) {
    if (!integrationIdSet.has(id)) {
      throw new Error(`Unknown task integration id: ${id}`)
    }
    getIntegrationDefinition(id)
    ids.push(id)
  }
  return ids
}

export async function attachConfiguredIntegrationsForTask(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  spec: TaskSpecWithIntegrations
): Promise<void> {
  for (const integrationId of resolveTaskSpecIntegrationIds(spec)) {
    await insertTaskIntegrationIfMissing(ctx, taskId, integrationId)
  }
}
