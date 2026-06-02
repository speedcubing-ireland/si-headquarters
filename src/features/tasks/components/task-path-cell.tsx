import {
  buildTaskPathCandidates,
  DEFAULT_TASK_PATH_FONT,
  selectTaskPathLayout,
} from "@/components/data-views/task-path-layout"
import * as TaskLabelSelector from "@/components/data-selectors/task-label-selector"
import { api } from "@/convex/_generated/api"
import type { TaskInlineRow } from "@/features/tasks/task-inline-row"
import { taskInlineIndicatorPropsFromRow } from "@/features/subtasks/task-inline-indicator-props"
import { TaskInlineIndicators } from "@/features/subtasks/task-inline-indicators"
import { useMeasuredElement } from "@/hooks/use-measured-element"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import { ChevronRightIcon } from "lucide-react"
import { useMemo, type ReactNode } from "react"

const TASK_PATH_CELL_TRAILING_PADDING_PX = 4

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
  const setLabels = useMutation(api.tasks.mutations.setTaskLabels)
  const [rootRef, rootMeasurement] = useMeasuredElement(DEFAULT_TASK_PATH_FONT)
  const primaryLabel = row.labels.at(0)
  const candidates = useMemo(
    () =>
      buildTaskPathCandidates({
        taskTitle: row.path.taskTitle,
        subtaskTitle: row.path.subtaskTitle,
        subtaskIndicator: row.path.subtaskIndicator,
        hasBlockIndicator: row.blockers.count > 0,
        labels: {
          count: row.labels.length,
          primaryName: primaryLabel?.name,
        },
        textFont: rootMeasurement.font,
        subtaskTitleId: row.path.subtaskTitleId,
      }),
    [
      primaryLabel?.name,
      rootMeasurement.font,
      row.blockers.count,
      row.labels.length,
      row.path.subtaskIndicator,
      row.path.subtaskTitle,
      row.path.subtaskTitleId,
      row.path.taskTitle,
    ]
  )
  const layout = useMemo(
    () =>
      selectTaskPathLayout(
        candidates,
        Math.max(0, rootMeasurement.width - TASK_PATH_CELL_TRAILING_PADDING_PX)
      ),
    [candidates, rootMeasurement.width]
  )
  const showLabelTooltip =
    primaryLabel !== undefined &&
    (row.labels.length > 1 || layout.labelText !== primaryLabel.name)

  return (
    <div
      ref={rootRef}
      className="flex min-h-5 min-w-0 flex-1 items-center gap-2 overflow-hidden pr-1"
    >
      <div className="flex min-w-0 shrink-0 flex-nowrap items-center gap-1">
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
        <TaskInlineIndicators {...taskInlineIndicatorPropsFromRow(row)} />
      </div>
      {primaryLabel !== undefined ? (
        <TaskLabelSelector.CompactButton
          displayText={layout.labelText}
          selectedLabels={row.labels}
          showSelectedLabelsTooltip={showLabelTooltip}
          value={row.labels.map((label) => label._id)}
          variant="icon"
          size="default"
          className="ml-auto shrink-0 self-center"
          onChange={(labelIds) => {
            void setLabels({ id: row.task._id, labelIds })
          }}
        />
      ) : null}
    </div>
  )
}
