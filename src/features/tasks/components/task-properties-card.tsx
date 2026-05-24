import { TaskDateButton } from "@/components/data-selectors/task-date-button"
import { TaskLabelButton } from "@/components/data-selectors/task-label-button"
import { TaskOwnerButton } from "@/components/data-selectors/task-owner-button"
import { TaskStatusButton } from "@/components/data-selectors/task-status-button"
import { UserButton } from "@/components/data-selectors/user-button"
import { Button } from "@/components/ui/button"
import {
  PageCard,
  PageCardContent,
  PageCardFooter,
  PageCardRow,
} from "@/components/page-card"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import type { TaskStatusView } from "@/convex/tasks/status/resolver"
import { useMutation } from "convex/react"
import {
  CableIcon,
  CastleIcon,
  InfoIcon,
  StampIcon,
  TagIcon,
  TargetIcon,
  TrafficConeIcon,
  UserIcon,
} from "lucide-react"

function firstAssigneeId(assigneeIds: Doc<"tasks">["assigneeIds"]) {
  return Array.isArray(assigneeIds) ? (assigneeIds[0] ?? null) : null
}

export function TaskPropertiesCard({
  labels,
  statusView,
  task,
}: {
  labels: Doc<"taskLabels">[]
  statusView: TaskStatusView
  task: Doc<"tasks">
}) {
  const setStatus = useMutation(api.tasks.mutations.setTaskStatus)
  const reopenTask = useMutation(api.tasks.mutations.reopenTask)
  const setAssignees = useMutation(api.tasks.mutations.setTaskAssignees)
  const setOwner = useMutation(api.tasks.mutations.setTaskOwner)
  const setLabels = useMutation(api.tasks.mutations.setTaskLabels)
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)

  return (
    <PageCard title="Properties" icon={<InfoIcon className="size-4" />}>
      <PageCardContent className="flex-1">
        <PageCardRow
          icon={<TrafficConeIcon className="size-4" />}
          label="Status"
        >
          <TaskStatusButton
            statusView={statusView}
            onChange={(status) => setStatus({ id: task._id, status })}
            onAction={(action) => {
              if (action === "reopen") {
                return reopenTask({ id: task._id })
              }
            }}
          />
        </PageCardRow>
        <PageCardRow icon={<UserIcon className="size-4" />} label="Assignee">
          <UserButton
            value={firstAssigneeId(task.assigneeIds)}
            onChange={(assigneeId) =>
              setAssignees({
                id: task._id,
                assigneeIds: assigneeId ? [assigneeId] : [],
              })
            }
          />
        </PageCardRow>
        <PageCardRow icon={<CastleIcon className="size-4" />} label="Owner">
          <TaskOwnerButton
            value={task.owner}
            onChange={(owner) => setOwner({ id: task._id, owner })}
          />
        </PageCardRow>
        <PageCardRow icon={<TagIcon className="size-4" />} label="Labels">
          <TaskLabelButton
            value={labels.map((label) => label._id)}
            onChange={(labelIds) => setLabels({ id: task._id, labelIds })}
          />
        </PageCardRow>
        <PageCardRow icon={<TargetIcon className="size-4" />} label="Due Date">
          <TaskDateButton
            value={task.dueDate}
            onChange={(dueDate) => {
              setDueDate({ id: task._id, dueDate })
            }}
          />
        </PageCardRow>
      </PageCardContent>
      <PageCardFooter className="grid grid-cols-2 gap-2">
        <Button variant="outline">
          <StampIcon />
          Add Reviewer
        </Button>
        <Button variant="outline">
          <CableIcon />
          Add Integration
        </Button>
      </PageCardFooter>
    </PageCard>
  )
}
