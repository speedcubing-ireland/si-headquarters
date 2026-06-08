import * as TaskDateSelector from "@/components/data-selectors/task-date-selector"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import { TaskInlineIndicators } from "@/features/subtasks/task-inline-indicators"
import type { FunctionReturnType } from "convex/server"
import { useMutation, useQuery } from "convex/react"
import { BellIcon, CornerDownRightIcon } from "lucide-react"
import { Streamdown } from "streamdown"
import { Badge } from "@/components/ui/badge"
import type { Id } from "@/convex/_generated/dataModel"
import { EditDetailsFormDialog } from "@/features/shared/edit-details-form-dialog"
import DynamicActionButton from "./dynamic-action-button"
import { RouterButton } from "@/components/ui/router-button"
import { PHASE_COLOR_CLASSES } from "@/components/data-selectors/phase-meta"
import { TaskRemindersDialog } from "@/features/tasks/components/task-reminders"

type TaskDetails = FunctionReturnType<typeof api.tasks.queries.getDetails>

function ParentLink({ parent }: { parent: TaskDetails["parent"] }) {
  if (!parent) return null

  if (parent.type === "phases") {
    return (
      <>
        <CornerDownRightIcon className="size-4" />
        <RouterButton
          to={`/competitions/$id`}
          params={{ id: parent.competition._id }}
          variant="outline"
          size="sm"
        >
          <span className="truncate">{parent.competition.name}</span>
          <Badge variant="outline" className="ml-2 gap-1.25">
            <span
              className={`size-2 rounded-full ${PHASE_COLOR_CLASSES[parent.color]}`}
              aria-hidden="true"
            />
            {parent.name}
          </Badge>
        </RouterButton>
      </>
    )
  }

  return (
    <>
      <CornerDownRightIcon className="size-4" />
      <RouterButton
        to={`/tasks/$id`}
        params={{ id: parent._id }}
        variant="outline"
        size="sm"
      >
        {parent.name}
        <TaskInlineIndicators
          kind={parent.kind}
          progress={parent.progress}
          subtaskSummary={parent.subtaskSummary}
        />
      </RouterButton>
    </>
  )
}

export function TaskDetailsCard({ taskId }: { taskId: Id<"tasks"> }) {
  const taskDetails = useQuery(api.tasks.queries.getDetails, { id: taskId })
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)
  const updateDetails = useMutation(api.tasks.mutations.setTaskDetails)
  const isWatching = useQuery(api.subscriptions.index.getSubscription, {
    object: {
      type: "tasks",
      id: taskId,
    },
  })
  const setSubscription = useMutation(api.subscriptions.index.setSubscription)
  const isSubscribed = isWatching === true
  const watchingText = isSubscribed ? "Subscribed" : "Watch"
  const watchingVariant = isSubscribed ? "ghost" : "outline"

  if (taskDetails === undefined) {
    return null
  }

  const task = taskDetails.task
  const parent = taskDetails.parent

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-2xl">{task.name}</CardTitle>
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <ParentLink parent={parent} />
          <TaskDateSelector.CompactButton
            value={task.dueDate}
            onChange={(dueDate) => {
              void setDueDate({ id: task._id, dueDate })
            }}
          />
        </div>
        <CardAction>
          <EditDetailsFormDialog
            descriptionId="task-description"
            descriptionPlaceholder="Add the task description..."
            initialValue={task}
            nameId="task-name"
            title="Edit task details"
            triggerLabel="Edit task details"
            onSubmit={(value) => updateDetails({ id: task._id, ...value })}
          />
        </CardAction>
      </CardHeader>
      <CardContent divided className="border-t">
        <Streamdown>{task.description ?? "Enter a description..."}</Streamdown>
      </CardContent>
      <CardFooter className="flex gap-2">
        <DynamicActionButton task={task} />
        <Button
          size="lg"
          variant={watchingVariant}
          onClick={() => {
            void setSubscription({
              object: {
                type: "tasks",
                id: taskId,
              },
              subscribe: !isSubscribed,
            })
          }}
        >
          <BellIcon />
          {watchingText}
        </Button>
        <TaskRemindersDialog taskId={taskId} />
      </CardFooter>
    </Card>
  )
}
