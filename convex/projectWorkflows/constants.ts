export const PROJECT_WORKFLOW_IDS = ["certificates.ordering"] as const

export const PROJECT_WORKFLOW_RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "attention",
  "noop",
  "failed",
] as const

export const PROJECT_WORKFLOW_RESULT_STATUSES = [
  "completed",
  "attention",
  "noop",
] as const
