import * as TaskDateSelector from "@/components/data-selectors/task-date-selector"
import * as TaskOwnerSelector from "@/components/data-selectors/task-owner-selector"
import * as TaskStatusSelector from "@/components/data-selectors/task-status-selector"
import * as UserSelector from "@/components/data-selectors/user-selector"
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
      <div className="flex shrink-0 items-center justify-center justify-self-center">
        <UserSelector.MultiIconButton
        selectedUsers={row.assignees.users}
        value={row.assignees.userIds}
        onChange={(assigneeIds) => {
          void setAssignees({
            id: row.task._id,
            assigneeIds,
          })
        }}
        avatarProps={{ className: "size-5", size: "default" }}
        />
      </div>
      <div className="flex shrink-0 items-center justify-center justify-self-center">
        <TaskStatusSelector.IconButton
        statusView={row.statusView}
        onChange={(newStatus) => {
          void setTaskStatus({ id: row.task._id, status: newStatus })
        }}
        iconProps={{ className: "size-5" }}
        />
      </div>
      <div className="flex min-w-0 items-center justify-self-stretch">
        <TaskPathCell row={row} />
      </div>
      <div className="flex shrink-0 items-center justify-end justify-self-end">
        <TaskDateSelector.InlineTextButton
        value={row.task.dueDate}
        onChange={(newDate) => {
          void setDueDate({ id: row.task._id, dueDate: newDate })
        }}
        className="font-mono text-muted-foreground"
        />
      </div>
      <div className="flex shrink-0 items-center justify-center justify-self-center">
        <TaskOwnerSelector.IconButton
        value={ownerValue}
        selectedOwner={row.owner}
        onChange={(newOwner) => {
          void setTaskOwner({ id: row.task._id, owner: newOwner })
        }}
        avatarProps={{ className: "size-5", size: "default" }}
        />
      </div>
    </>
  )
}
