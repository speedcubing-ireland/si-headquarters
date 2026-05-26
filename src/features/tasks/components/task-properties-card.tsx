import { TaskDateButton } from "@/components/data-selectors/task-date-button"
import { TaskLabelButton } from "@/components/data-selectors/task-label-button"
import { TaskOwnerButton } from "@/components/data-selectors/task-owner-button"
import { TaskStatusButton } from "@/components/data-selectors/task-status-button"
import { UserButton } from "@/components/data-selectors/user-button"
import { AddTaskReviewerButton } from "@/features/tasks/components/add-task-reviewer-button"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
  CableIcon,
  CastleIcon,
  InfoIcon,
  TagIcon,
  TargetIcon,
  TrafficConeIcon,
  UserIcon,
} from "lucide-react"

function LoadingValue() {
  return <Skeleton className="h-8 w-24" />
}

export function TaskPropertiesCard({ taskId }: { taskId: Id<"tasks"> }) {
  const properties = useQuery(api.tasks.queries.getProperties, { id: taskId })
  const setStatus = useMutation(api.tasks.mutations.setTaskStatus)
  const setAssignees = useMutation(api.tasks.mutations.setTaskAssignees)
  const setOwner = useMutation(api.tasks.mutations.setTaskOwner)
  const setLabels = useMutation(api.tasks.mutations.setTaskLabels)
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)

  if (properties === undefined) {
    return (
      <PageCard title="Properties" icon={<InfoIcon className="size-4" />}>
        <PageCardContent className="flex-1">
          <PageCardRow
            icon={<TrafficConeIcon className="size-4" />}
            label="Status"
          >
            <LoadingValue />
          </PageCardRow>
          <PageCardRow icon={<UserIcon className="size-4" />} label="Assignee">
            <LoadingValue />
          </PageCardRow>
          <PageCardRow icon={<CastleIcon className="size-4" />} label="Owner">
            <LoadingValue />
          </PageCardRow>
          <PageCardRow icon={<TagIcon className="size-4" />} label="Labels">
            <LoadingValue />
          </PageCardRow>
          <PageCardRow
            icon={<TargetIcon className="size-4" />}
            label="Due Date"
          >
            <LoadingValue />
          </PageCardRow>
        </PageCardContent>
        <PageCardFooter className="grid grid-cols-2 gap-2">
          <Button disabled>Add Reviewer</Button>
          <Button variant="outline" disabled>
            <CableIcon />
            Add Integration
          </Button>
        </PageCardFooter>
      </PageCard>
    )
  }

  const { assignees, labels, owner, statusView, task } = properties

  return (
    <PageCard title="Properties" icon={<InfoIcon className="size-4" />}>
      <PageCardContent className="flex-1">
        <PageCardRow
          icon={<TrafficConeIcon className="size-4" />}
          label="Status"
        >
          <TaskStatusButton
            statusView={statusView}
            onChange={(status) => {
              return setStatus({ id: taskId, status })
            }}
          />
        </PageCardRow>
        <PageCardRow icon={<UserIcon className="size-4" />} label="Assignee">
          <UserButton
            selectionMode="multiple"
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
          <TaskOwnerButton
            selectedOwner={owner}
            value={task.owner}
            onChange={(owner) => {
              return setOwner({ id: taskId, owner })
            }}
          />
        </PageCardRow>
        <PageCardRow icon={<TagIcon className="size-4" />} label="Labels">
          <TaskLabelButton
            selectedLabels={labels}
            value={labels.map((label) => label._id)}
            onChange={(labelIds) => {
              return setLabels({ id: taskId, labelIds })
            }}
          />
        </PageCardRow>
        <PageCardRow icon={<TargetIcon className="size-4" />} label="Due Date">
          <TaskDateButton
            value={task.dueDate}
            onChange={(dueDate) => {
              return setDueDate({ id: taskId, dueDate })
            }}
          />
        </PageCardRow>
      </PageCardContent>
      <PageCardFooter className="grid grid-cols-2 gap-2">
        <AddTaskReviewerButton taskId={taskId} />
        <Button variant="outline" noop>
          <CableIcon />
          Add Integration
        </Button>
      </PageCardFooter>
    </PageCard>
  )
}
