import type { TaskStatusCommand } from "@/convex/tasks/status/resolver"
import type { TaskStatus } from "@/convex/tasks/status/validators"

export type TaskStatusIconTone = "status" | "current"

const TASK_STATUS_FG_CLASS = {
  backlog: "text-task-status-backlog-fg",
  "to-do": "text-task-status-to-do-fg",
  "in-progress": "text-task-status-in-progress-fg",
  "awaiting-review": "text-task-status-awaiting-review-fg",
  done: "text-task-status-done-fg",
  cancelled: "text-task-status-cancelled-fg",
  auto: "text-task-status-auto-fg",
} satisfies Record<TaskStatusCommand, string>

export function getTaskStatusIconClassName(
  status: TaskStatus | TaskStatusCommand,
  tone: TaskStatusIconTone = "status"
) {
  if (tone === "current") {
    return "text-current"
  }
  return TASK_STATUS_FG_CLASS[status]
}
