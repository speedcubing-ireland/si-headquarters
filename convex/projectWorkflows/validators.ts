import { v, type Infer } from "convex/values"
import {
  PROJECT_WORKFLOW_IDS,
  PROJECT_WORKFLOW_RESULT_STATUSES,
  PROJECT_WORKFLOW_RUN_STATUSES,
} from "@/convex/projectWorkflows/constants"
import { literalUnion } from "@/convex/utils"

export const projectWorkflowId = literalUnion(PROJECT_WORKFLOW_IDS)

export const projectWorkflowTrigger = v.union(
  v.object({ type: v.literal("manual"), actorId: v.id("users") }),
  v.object({ type: v.literal("daily") })
)

export const projectWorkflowRunStatus = literalUnion(
  PROJECT_WORKFLOW_RUN_STATUSES
)

export const projectWorkflowResultStatus = literalUnion(
  PROJECT_WORKFLOW_RESULT_STATUSES
)

export const projectWorkflowSchedule = v.union(
  v.object({ kind: v.literal("manual") }),
  v.object({ kind: v.literal("daily") })
)

export const projectWorkflowConfig = v.union(
  v.object({
    kind: v.literal("certificates.ordering"),
    leadTimeDays: v.number(),
  })
)

export const projectWorkflowState = v.null()

export const projectWorkflowFields = {
  projectId: v.id("projects"),
  workflowId: projectWorkflowId,
  enabled: v.boolean(),
  config: projectWorkflowConfig,
  state: projectWorkflowState,
  installedAt: v.number(),
  updatedAt: v.number(),
}

export const projectWorkflowRunFields = {
  projectWorkflowId: v.id("projectWorkflows"),
  projectId: v.id("projects"),
  workflowId: projectWorkflowId,
  trigger: projectWorkflowTrigger,
  status: projectWorkflowRunStatus,
  queuedAt: v.number(),
  startedAt: v.union(v.number(), v.null()),
  completedAt: v.union(v.number(), v.null()),
  summary: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
}

export const projectWorkflowDefinitionMeta = v.object({
  id: projectWorkflowId,
  pluginId: v.string(),
  label: v.string(),
  description: v.string(),
  defaultConfig: projectWorkflowConfig,
  schedule: projectWorkflowSchedule,
})

export const projectWorkflowRow = v.object({
  _id: v.id("projectWorkflows"),
  _creationTime: v.number(),
  ...projectWorkflowFields,
  definition: projectWorkflowDefinitionMeta,
})

export const projectWorkflowRunRow = v.object({
  _id: v.id("workflowRuns"),
  _creationTime: v.number(),
  ...projectWorkflowRunFields,
})

export type ProjectWorkflowId = Infer<typeof projectWorkflowId>
export type ProjectWorkflowTrigger = Infer<typeof projectWorkflowTrigger>
export type ProjectWorkflowRunStatus = Infer<typeof projectWorkflowRunStatus>
export type ProjectWorkflowResultStatus = Infer<
  typeof projectWorkflowResultStatus
>
export type ProjectWorkflowConfig = Infer<typeof projectWorkflowConfig>
export type ProjectWorkflowState = Infer<typeof projectWorkflowState>
export type ProjectWorkflowSchedule = Infer<typeof projectWorkflowSchedule>
