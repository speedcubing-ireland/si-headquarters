import {
  SELECTOR_ICON_BUTTON_HOVER_CLASS,
  SELECTOR_ICON_SLOT_CLASS,
} from "@/components/data-selectors/selector-layout"
import * as TaskAssigneeSelector from "@/components/data-selectors/task-assignee-selector"
import * as TaskDateSelector from "@/components/data-selectors/task-date-selector"
import * as TaskOwnerSelector from "@/components/data-selectors/task-owner-selector"
import * as TaskStatusSelector from "@/components/data-selectors/task-status-selector"
import { TaskPathCell } from "@/features/tasks/components/task-path-cell"
import {
  taskOwnerSelectorValue,
  type TaskInlineRow,
} from "@/features/tasks/task-inline-row"
import { api } from "@/convex/_generated/api"
import { useMutation } from "convex/react"

export function TaskInlineDataRow({ row }: { row: TaskInlineRow }) {
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)
  const setTaskOwner = useMutation(api.tasks.mutations.setTaskOwner)
  const setTaskStatus = useMutation(api.tasks.mutations.setTaskStatus)
  const setAssignees = useMutation(api.tasks.mutations.setTaskAssignees)

  const ownerValue = taskOwnerSelectorValue(row.owner)

  return (
    <>
      <div className={SELECTOR_ICON_SLOT_CLASS}>
        <TaskAssigneeSelector.IconButton
          className={SELECTOR_ICON_BUTTON_HOVER_CLASS}
          assignees={row.assignees}
          scope={{ type: "tasks", id: row.task._id }}
          onChange={(assigneeIds) => {
            void setAssignees({
              id: row.task._id,
              assigneeIds,
            })
          }}
          avatarProps={{ className: "size-5", size: "default" }}
        />
      </div>
      <div className={SELECTOR_ICON_SLOT_CLASS}>
        <TaskStatusSelector.IconButton
          className={SELECTOR_ICON_BUTTON_HOVER_CLASS}
          statusView={row.statusView}
          onChange={(newStatus) => {
            void setTaskStatus({ id: row.task._id, status: newStatus })
          }}
          iconProps={{ className: "size-5" }}
        />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-self-stretch">
        <TaskPathCell row={row} />
      </div>
      <div className="flex shrink-0 items-center justify-end justify-self-end pr-1">
        <TaskDateSelector.InlineTextButton
          value={row.task.dueDate}
          onChange={(newDate) => {
            void setDueDate({ id: row.task._id, dueDate: newDate })
          }}
          className="font-mono text-muted-foreground"
        />
      </div>
      <div className={SELECTOR_ICON_SLOT_CLASS}>
        <TaskOwnerSelector.IconButton
          className={SELECTOR_ICON_BUTTON_HOVER_CLASS}
          value={ownerValue}
          selectedOwner={row.owner}
          scope={{ type: "tasks", id: row.task._id }}
          onChange={(newOwner) => {
            void setTaskOwner({ id: row.task._id, owner: newOwner })
          }}
          avatarProps={{ className: "size-5", size: "default" }}
        />
      </div>
    </>
  )
}
