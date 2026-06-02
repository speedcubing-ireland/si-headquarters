import {
  getTaskStatusIconClassName,
  TASK_STATUS_META,
} from "@/components/data-selectors/task-status-meta"
import type { TaskViewSubtaskSummary } from "@/convex/tasks/view"
import { isTerminalRowStatus } from "@/features/tasks/task-row-status"
import { cn } from "@/lib/utils"

export function SubtaskSummaryTooltipContent({
  summary,
}: {
  summary: TaskViewSubtaskSummary
}) {
  return (
    <ul className="space-y-1.5 text-left">
      {summary.map((subtask) => {
        const status = TASK_STATUS_META[subtask.status]
        const StatusIcon = status.icon
        const isCompleted = isTerminalRowStatus(subtask.status)

        return (
          <li key={subtask._id} className="flex items-center gap-2">
            <StatusIcon
              className={cn(
                "size-3.5 shrink-0",
                getTaskStatusIconClassName(subtask.status)
              )}
              aria-label={status.label}
            />
            <span className="min-w-0">
              <span className="sr-only">{status.label}: </span>
              <span
                className={cn(
                  "wrap-break-word",
                  isCompleted && "text-background/70 line-through"
                )}
              >
                {subtask.name}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
