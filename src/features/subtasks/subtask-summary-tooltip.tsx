import type { TaskViewSubtaskSummary } from "@/convex/tasks/view"
import { getTaskStatusLabel, TaskStatusIcon } from "@/features/tasks/status"
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
        const isCompleted = isTerminalRowStatus(subtask.status)

        return (
          <li
            key={subtask._id}
            className={cn(
              "flex items-center gap-2",
              isCompleted && "text-muted-foreground"
            )}
          >
            <TaskStatusIcon status={subtask.status} size="sm" tone="current" />
            <span className="min-w-0">
              <span className="sr-only">
                {getTaskStatusLabel(subtask.status)}:{" "}
              </span>
              <span
                className={cn("wrap-break-word", isCompleted && "line-through")}
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
