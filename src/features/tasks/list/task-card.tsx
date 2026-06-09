import { SELECTOR_ICON_BUTTON_HOVER_CLASS } from "@/components/data-selectors/selector-layout"
import * as TaskAssigneeSelector from "@/components/data-selectors/task-assignee-selector"
import * as TaskDateSelector from "@/components/data-selectors/task-date-selector"
import * as TaskLabelSelector from "@/components/data-selectors/task-label-selector"
import * as TaskOwnerSelector from "@/components/data-selectors/task-owner-selector"
import * as TaskStatusSelector from "@/components/data-selectors/task-status-selector"
import { Card } from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import { taskInlineIndicatorPropsFromRow } from "@/features/subtasks/task-inline-indicator-props"
import { TaskInlineIndicators } from "@/features/subtasks/task-inline-indicators"
import { TaskRootLink } from "@/features/tasks/components/task-root-link"
import {
  taskOwnerSelectorValue,
  type TaskBoardRow,
} from "@/features/tasks/task-inline-row"
import { Link } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import { CornerDownRightIcon } from "lucide-react"

function TaskContext({ row }: { row: TaskBoardRow }) {
  const parentId = row.path.subtaskTitleId
  const hasParent = parentId !== null && row.path.subtaskTitle.length > 0
  const hasSubtasks = row.statusView.progress.total > 0
  const hasBlockers = row.blockers.openCount > 0

  if (!hasParent && !hasSubtasks && !hasBlockers) return null

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {hasParent ? (
        <Link
          to="/tasks/$id"
          params={{ id: parentId }}
          title={row.path.subtaskTitle}
          onClick={(event) => {
            event.stopPropagation()
          }}
          className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          <CornerDownRightIcon className="size-3 shrink-0" />
          <span className="truncate">{row.path.subtaskTitle}</span>
        </Link>
      ) : null}
      <TaskInlineIndicators {...taskInlineIndicatorPropsFromRow(row)} />
    </div>
  )
}

function TaskCardControls({ row }: { row: TaskBoardRow }) {
  const setStatus = useMutation(api.tasks.mutations.setTaskStatus)
  const setAssignees = useMutation(api.tasks.mutations.setTaskAssignees)
  const setLabels = useMutation(api.tasks.mutations.setTaskLabels)
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)
  const setTaskOwner = useMutation(api.tasks.mutations.setTaskOwner)

  const ownerValue = taskOwnerSelectorValue(row.owner)

  return (
    <div className="flex items-center gap-1.5 border-t px-2 py-1.5">
      <div className="flex shrink-0 items-center gap-2">
        <TaskStatusSelector.IconButton
          className={SELECTOR_ICON_BUTTON_HOVER_CLASS}
          statusView={row.statusView}
          iconProps={{ className: "size-5" }}
          onChange={(status) => {
            void setStatus({ id: row.task._id, status })
          }}
        />
        <TaskAssigneeSelector.IconButton
          className={SELECTOR_ICON_BUTTON_HOVER_CLASS}
          assignees={row.assignees}
          avatarProps={{ className: "size-5", size: "default" }}
          onChange={(assigneeIds) => {
            void setAssignees({ id: row.task._id, assigneeIds })
          }}
        />
      </div>
      <div className="h-5 w-px shrink-0 bg-border" />
      <div className="flex min-w-0 flex-1 items-center gap-0.5 text-muted-foreground">
        <TaskLabelSelector.CompactButton
          size="xs"
          variant="ghost"
          className="min-w-0"
          value={row.labels.map((label) => label._id)}
          selectedLabels={row.labels}
          onChange={(labelIds) => {
            void setLabels({ id: row.task._id, labelIds })
          }}
        />
        <TaskDateSelector.CompactButton
          size="xs"
          variant="ghost"
          value={row.task.dueDate}
          className="font-mono"
          onChange={(dueDate) => {
            void setDueDate({ id: row.task._id, dueDate })
          }}
        />
        <span className="ml-auto flex min-w-6 shrink-0 items-center justify-start">
          <TaskOwnerSelector.IconButton
            className={SELECTOR_ICON_BUTTON_HOVER_CLASS}
            value={ownerValue}
            selectedOwner={row.owner}
            avatarProps={{ className: "size-4.5", size: "default" }}
            onChange={(owner) => {
              void setTaskOwner({ id: row.task._id, owner })
            }}
          />
        </span>
      </div>
    </div>
  )
}

export function TaskCard({ row }: { row: TaskBoardRow }) {
  return (
    <Card
      size="sm"
      className="gap-0 py-0 ring-foreground/10 transition-shadow hover:shadow-md hover:ring-foreground/20"
    >
      <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <Link
            to="/tasks/$id"
            params={{ id: row.path.taskTitleId }}
            title={row.path.taskTitle}
            onClick={(event) => {
              event.stopPropagation()
            }}
            className="line-clamp-2 min-w-0 text-sm leading-snug font-medium text-foreground hover:underline"
          >
            {row.path.taskTitle}
          </Link>
          {row.competitionId !== null || row.projectId !== null ? (
            <TaskRootLink
              row={row}
              className="h-5 self-start px-1.5 text-[10px]"
            />
          ) : null}
        </div>
        <TaskContext row={row} />
      </div>
      <TaskCardControls row={row} />
    </Card>
  )
}
