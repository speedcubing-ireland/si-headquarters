import {
  MANUAL_TASK_INTEGRATION_STATUSES,
  TASK_INTEGRATION_STATUSES,
  type ManualTaskIntegrationStatus,
  type TaskIntegrationStatus,
} from "@/convex/plugins/core/types"

const statusSet = new Set<string>(TASK_INTEGRATION_STATUSES)
const manualStatusSet = new Set<string>(MANUAL_TASK_INTEGRATION_STATUSES)

export function isIntegrationStatus(
  value: string
): value is TaskIntegrationStatus {
  return statusSet.has(value)
}

export function isManualIntegrationStatus(
  value: TaskIntegrationStatus
): value is ManualTaskIntegrationStatus {
  return manualStatusSet.has(value)
}
