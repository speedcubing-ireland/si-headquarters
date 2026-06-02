import {
  TASK_INTEGRATION_STATUSES,
  type TaskIntegrationStatus,
} from "@/convex/plugins/core/types"

const statusSet = new Set<string>(TASK_INTEGRATION_STATUSES)

export function isIntegrationStatus(
  value: string
): value is TaskIntegrationStatus {
  return statusSet.has(value)
}
