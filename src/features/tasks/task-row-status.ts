import type { TaskStatus } from "@/convex/tasks/status/validators"

export function isTerminalRowStatus(status: TaskStatus) {
  return status === "done" || status === "cancelled"
}
