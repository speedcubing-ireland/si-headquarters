import * as TaskDateSelector from "@/components/data-selectors/task-date-selector"
import * as TaskLabelSelector from "@/components/data-selectors/task-label-selector"
import * as TaskOwnerSelector from "@/components/data-selectors/task-owner-selector"
import * as TaskStatusSelector from "@/components/data-selectors/task-status-selector"
import * as UserSelector from "@/components/data-selectors/user-selector"
import { AddTaskIntegrationButton } from "@/features/tasks/components/add-task-integration-button"
import { AddTaskReviewerButton } from "@/features/tasks/components/add-task-reviewer-button"
import {
  PageCard,
  PageCardContent,
  PageCardFooter,
  PageCardRow,
} from "@/components/page-card"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import {
  CastleIcon,
  InfoIcon,
  TagIcon,
  TargetIcon,
  TrafficConeIcon,
  UserIcon,
} from "lucide-react"

export function TaskPropertiesCard({ taskId }: { taskId: Id<"tasks"> }) {
  const properties = useQuery(api.tasks.queries.getProperties, { id: taskId })
  const setStatus = useMutation(api.tasks.mutations.setTaskStatus)
  const setAssignees = useMutation(api.tasks.mutations.setTaskAssignees)
  const setOwner = useMutation(api.tasks.mutations.setTaskOwner)
  const setLabels = useMutation(api.tasks.mutations.setTaskLabels)
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)

  if (properties === undefined) {
    return null
  }

  const { assignees, labels, owner, statusView, task } = properties

  return (
    <PageCard title="Properties" icon={<InfoIcon className="size-4" />}>
      <PageCardContent className="flex-1">
        <PageCardRow
          icon={<TrafficConeIcon className="size-4" />}
          label="Status"
        >
          <TaskStatusSelector.PropertyButton
            statusView={statusView}
            onChange={(status) => {
              void setStatus({ id: taskId, status })
            }}
          />
        </PageCardRow>
        <PageCardRow icon={<UserIcon className="size-4" />} label="Assignee">
          <UserSelector.MultiPropertyButton
            selectedUsers={assignees}
            value={assignees.map((user) => user._id)}
            onChange={(assigneeIds) => {
              void setAssignees({
                id: taskId,
                assigneeIds,
              })
            }}
          />
        </PageCardRow>
        <PageCardRow icon={<CastleIcon className="size-4" />} label="Owner">
          <TaskOwnerSelector.PropertyButton
            selectedOwner={owner}
            value={task.owner}
            onChange={(owner) => {
              void setOwner({ id: taskId, owner })
            }}
          />
        </PageCardRow>
        <PageCardRow icon={<TagIcon className="size-4" />} label="Labels">
          <TaskLabelSelector.PropertyButton
            selectedLabels={labels}
            value={labels.map((label) => label._id)}
            onChange={(labelIds) => {
              void setLabels({ id: taskId, labelIds })
            }}
          />
        </PageCardRow>
        <PageCardRow icon={<TargetIcon className="size-4" />} label="Due Date">
          <TaskDateSelector.PropertyButton
            value={task.dueDate}
            onChange={(dueDate) => {
              void setDueDate({ id: taskId, dueDate })
            }}
          />
        </PageCardRow>
      </PageCardContent>
      <PageCardFooter className="grid grid-cols-2 gap-2">
        <AddTaskReviewerButton taskId={taskId} />
        <AddTaskIntegrationButton taskId={taskId} />
      </PageCardFooter>
    </PageCard>
  )
}
