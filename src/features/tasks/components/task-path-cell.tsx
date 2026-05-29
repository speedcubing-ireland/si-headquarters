import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  buildTaskPathCandidates,
  DEFAULT_TASK_PATH_FONT,
  getCompactLabelText,
  selectTaskPathLayout,
} from "@/components/data-views/task-path-layout"
import type { TaskInlineRow } from "@/features/tasks/task-inline-row"
import { BlockIndicator } from "@/features/subtasks/block-indicator"
import { SubtaskBadge } from "@/features/subtasks/subtask-badge"
import { useMeasuredElement } from "@/hooks/use-measured-element"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"
import { ChevronRightIcon } from "lucide-react"
import { useMemo, type ReactNode } from "react"

const pathBadgeClassName =
  "inline-flex h-5 shrink-0 items-center gap-0.5 self-center py-0 text-xs leading-none"

function TaskPathLink({
  taskId,
  title,
  className,
  children,
}: {
  taskId: string
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      to="/tasks/$id"
      params={{ id: taskId }}
      title={title}
      className={cn(
        "shrink-0 whitespace-nowrap hover:text-foreground hover:underline",
        className
      )}
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      {children}
    </Link>
  )
}

export function TaskPathCell({ row }: { row: TaskInlineRow }) {
  const [rootRef, rootMeasurement] = useMeasuredElement(DEFAULT_TASK_PATH_FONT)
  const labelText = row.labels[0]?.name ?? ""
  const compactLabelText =
    row.labels.length > 0 ? getCompactLabelText(row.labels.length) : ""
  const candidates = useMemo(
    () =>
      buildTaskPathCandidates({
        taskTitle: row.path.taskTitle,
        subtaskTitle: row.path.subtaskTitle,
        subtaskIndicator: row.path.subtaskIndicator,
        hasBlockIndicator: row.blockers.count > 0,
        labelText,
        compactLabelText,
        textFont: rootMeasurement.font,
        focalTaskId: row.task._id,
        taskTitleId: row.path.taskTitleId,
        subtaskTitleId: row.path.subtaskTitleId,
      }),
    [
      compactLabelText,
      labelText,
      rootMeasurement.font,
      row.blockers.count,
      row.path.subtaskIndicator,
      row.path.subtaskTitle,
      row.path.subtaskTitleId,
      row.path.taskTitle,
      row.path.taskTitleId,
      row.task._id,
    ]
  )
  const layout = useMemo(
    () => selectTaskPathLayout(candidates, rootMeasurement.width),
    [candidates, rootMeasurement.width]
  )

  return (
    <div
      ref={rootRef}
      className="flex min-h-5 min-w-0 flex-1 items-center overflow-hidden"
    >
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1">
        {layout.taskText.length > 0 ? (
          <TaskPathLink
            taskId={row.path.taskTitleId}
            title={row.path.taskTitle}
            className="font-medium text-foreground"
          >
            {layout.taskText}
          </TaskPathLink>
        ) : null}
        {layout.taskText.length > 0 &&
        layout.subtaskText.length > 0 &&
        row.path.subtaskTitleId !== null ? (
          <ChevronRightIcon className="size-4 shrink-0 self-center text-muted-foreground" />
        ) : null}
        {layout.subtaskText.length > 0 && row.path.subtaskTitleId !== null ? (
          <TaskPathLink
            taskId={row.path.subtaskTitleId}
            title={row.path.subtaskTitle}
            className={cn(
              layout.taskText.length > 0
                ? "text-muted-foreground"
                : "font-medium text-foreground"
            )}
          >
            {layout.subtaskText}
          </TaskPathLink>
        ) : null}
        <SubtaskBadge
          kind={row.task.kind}
          progress={row.statusView.progress}
          className={pathBadgeClassName}
        />
        <BlockIndicator {...row.blockers} className={pathBadgeClassName} />
      </div>
      {labelText.length > 0 ? (
        <Button
          variant="icon"
          className="ml-auto shrink-0 self-center"
          aria-label={labelText}
          type="button"
        >
          <Badge
            className="inline-flex h-5 items-center bg-purple-50 py-0 text-xs leading-none text-purple-700 dark:bg-purple-950 dark:text-purple-300"
            title={labelText}
          >
            {layout.labelText}
          </Badge>
        </Button>
      ) : null}
    </div>
  )
}
