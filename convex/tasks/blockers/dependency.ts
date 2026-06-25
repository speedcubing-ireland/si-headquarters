import { v, type Infer } from "convex/values"
import type { BlockerCounts } from "@/convex/tasks/blockers/counts"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import type { TaskStatus } from "@/convex/tasks/status/validators"

export const taskDependencyStatusType = v.union(
  v.literal("blocking"),
  v.literal("blocked"),
  v.literal("no-dependencies")
)

export type TaskDependencyStatus = Infer<typeof taskDependencyStatusType>

export function deriveDependencyStatuses(
  blockers: Pick<BlockerCounts, "openCount" | "blockingCount">,
  effectiveStatus: TaskStatus
): TaskDependencyStatus[] {
  const isBlocked = blockers.openCount > 0
  const isBlocking =
    !isTerminalComplete(effectiveStatus) && blockers.blockingCount > 0

  if (!isBlocked && !isBlocking) return ["no-dependencies"]

  const statuses: TaskDependencyStatus[] = []
  if (isBlocked) statuses.push("blocked")
  if (isBlocking) statuses.push("blocking")
  return statuses
}
