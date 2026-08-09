import { v, type Infer } from "convex/values"
import {
  MANUAL_TASK_INTEGRATION_STATUSES,
  TASK_INTEGRATION_IDS,
  TASK_INTEGRATION_STATUSES,
} from "@/convex/integrations/taskIntegrations/constants"
import { linkedResourceData } from "@/convex/integrations/validators"
import { literalUnion } from "@/convex/utils"

export const taskIntegrationRunInput = v.object({
  overwriteEvents: v.optional(v.boolean()),
})

export const taskIntegrationId = literalUnion(TASK_INTEGRATION_IDS)

export const taskIntegrationStatus = literalUnion(TASK_INTEGRATION_STATUSES)

export const manualTaskIntegrationStatus = literalUnion(
  MANUAL_TASK_INTEGRATION_STATUSES
)

export const taskIntegrationOutput = v.union(
  v.object({
    kind: v.literal("schedule_transfer"),
    wcifJson: v.optional(v.string()),
    wcaUrl: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("checkin_populate"),
    rowsWritten: v.optional(v.number()),
  }),
  v.object({
    kind: v.literal("canva_design"),
    designId: v.string(),
    designUrl: v.string(),
    // Legacy rows may contain Canva's 15-minute URL. New previews are fetched on demand.
    thumbnailUrl: v.optional(v.string()),
  }),
  v.null()
)

export const taskIntegrationDefinitionMeta = v.object({
  id: taskIntegrationId,
  label: v.string(),
  pluginId: v.string(),
})

export const loadedRunContext = v.object({
  integrationId: taskIntegrationId,
  competitionId: v.id("competitions"),
  competitionName: v.string(),
  resources: v.record(v.string(), linkedResourceData),
})

export const taskIntegrationRow = v.object({
  _id: v.id("taskIntegrations"),
  _creationTime: v.number(),
  taskId: v.id("tasks"),
  integrationId: taskIntegrationId,
  status: taskIntegrationStatus,
  lastMessage: v.union(v.string(), v.null()),
  lastRunAt: v.union(v.number(), v.null()),
  runId: v.union(v.string(), v.null()),
  output: taskIntegrationOutput,
})

export const taskIntegrationListRow = v.object({
  ...taskIntegrationRow.fields,
  definition: taskIntegrationDefinitionMeta,
})

export type LoadedRunContext = Infer<typeof loadedRunContext>
export type TaskIntegrationId = Infer<typeof taskIntegrationId>
export type TaskIntegrationStatus = Infer<typeof taskIntegrationStatus>
export type ManualTaskIntegrationStatus = Infer<
  typeof manualTaskIntegrationStatus
>
export type TaskIntegrationRunInput = Infer<typeof taskIntegrationRunInput>
export type TaskIntegrationOutput = Infer<typeof taskIntegrationOutput>
