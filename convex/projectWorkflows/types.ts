import type { Doc } from "@/convex/_generated/dataModel"
import type { ActionCtx } from "@/convex/_generated/server"
import type { PluginId } from "@/convex/integrations/constants"
import type {
  ProjectWorkflowConfig,
  ProjectWorkflowId,
  ProjectWorkflowResultStatus,
  ProjectWorkflowSchedule,
  ProjectWorkflowState,
  ProjectWorkflowTrigger,
} from "@/convex/projectWorkflows/validators"

export interface ProjectWorkflowRunContext {
  project: Doc<"projects">
  installation: Doc<"projectWorkflows">
  trigger: ProjectWorkflowTrigger
}

export interface ProjectWorkflowRunResult {
  status: ProjectWorkflowResultStatus
  summary: string
  state?: ProjectWorkflowState
}

export type ProjectWorkflowRunner = (
  ctx: ActionCtx,
  run: ProjectWorkflowRunContext
) => Promise<ProjectWorkflowRunResult>

export interface ProjectWorkflowDefinition {
  id: ProjectWorkflowId
  pluginId: PluginId
  label: string
  description: string
  defaultConfig: ProjectWorkflowConfig
  schedule: ProjectWorkflowSchedule
  run: ProjectWorkflowRunner
}

export interface BackendProjectWorkflowPlugin {
  id: PluginId
  projectWorkflowDefinitions?: readonly ProjectWorkflowDefinition[]
}
