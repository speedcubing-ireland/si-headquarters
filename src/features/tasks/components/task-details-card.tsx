// To-do unfinished

import { TaskDateButton } from "@/components/data-selectors/task-date-button"
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
import { SubtaskBadge } from "@/features/subtasks/subtask-badge"
import type { FunctionReturnType } from "convex/server"
import { useMutation, useQuery } from "convex/react"
import {
  AlarmClockPlusIcon,
  BellIcon,
  CornerDownRightIcon,
  HandIcon,
} from "lucide-react"
import { Streamdown } from "streamdown"
import { EditTaskDetailsDialog } from "./edit-task-details-dialog"
import { Badge } from "@/components/ui/badge"
import type { Id } from "@/convex/_generated/dataModel"

type TaskDetails = FunctionReturnType<typeof api.tasks.queries.getDetails>

function ParentLink({ parent }: { parent: TaskDetails["parent"] }) {
  if (!parent) return null

  if (parent.type === "phases") {
    return (
      <>
        <CornerDownRightIcon className="size-4" />
        <Button variant="outline" size="sm">
          <span className="truncate">{parent.competition.name}</span>
          <Badge variant="outline" className="ml-2">
            {parent.name}
          </Badge>
        </Button>
      </>
    )
  }

  return (
    <>
      <CornerDownRightIcon className="size-4" />
      <Button variant="outline" size="sm">
        {parent.name}
        <SubtaskBadge
          className="flex"
          kind={parent.kind}
          progress={parent.progress}
        />
      </Button>
    </>
  )
}

export function TaskDetailsCard({ taskId }: { taskId: Id<"tasks"> }) {
  const taskDetails = useQuery(api.tasks.queries.getDetails, { id: taskId })
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)
  const claimTask = useMutation(api.tasks.mutations.claimTask)
  const isWatching = useQuery(api.subscriptions.index.getSubscription, {
    object: {
      type: "tasks",
      id: taskId,
    },
  })
  const setSubscription = useMutation(api.subscriptions.index.setSubscription)
  const watchingText = isWatching ? "Subscribed" : "Watch"
  const watchingVariant = isWatching ? "ghost" : "outline"

  if (taskDetails === undefined) {
    return (
      <Card className="col-span-full min-h-72">
        <CardHeader>
          <CardTitle className="text-2xl">Loading task...</CardTitle>
        </CardHeader>
        <CardContent divided className="border-t">
          <p className="text-sm text-muted-foreground">Loading details...</p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button size="lg" disabled>
            <HandIcon />
            Claim
          </Button>
          <Button size="lg" variant="outline" disabled>
            <BellIcon />
            Watch
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const task = taskDetails.task
  const parent = taskDetails.parent

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-2xl">{task.name}</CardTitle>
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <ParentLink parent={parent} />
          <TaskDateButton
            size="sm"
            value={task.dueDate}
            onChange={async (dueDate) => {
              await setDueDate({ id: task._id, dueDate })
            }}
          />
        </div>
        <CardAction>
          <EditTaskDetailsDialog task={task} />
        </CardAction>
      </CardHeader>
      <CardContent divided className="border-t">
        <Streamdown>{task.description ?? "Enter a description..."}</Streamdown>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button size="lg" onClick={() => claimTask({ id: taskId })}>
          <HandIcon />
          Claim
        </Button>
        <Button
          size="lg"
          variant={watchingVariant}
          onClick={() =>
            setSubscription({
              object: {
                type: "tasks",
                id: taskId,
              },
              subscribe: !isWatching,
            })
          }
        >
          <BellIcon />
          {watchingText}
        </Button>
        <Button size="lg" variant="outline">
          <AlarmClockPlusIcon />
          Reminders
        </Button>
      </CardFooter>
    </Card>
  )
}
