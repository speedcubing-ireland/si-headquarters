// To-do unfinished

import { TaskDateButton } from "@/components/data-selectors/task-date-button"
import { Badge } from "@/components/ui/badge"
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
import type { Doc } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { useMutation, useQuery } from "convex/react"
import {
  AlarmClockPlusIcon,
  BellIcon,
  CornerDownRightIcon,
  HandIcon,
  LoaderCircleIcon,
} from "lucide-react"
import { Streamdown } from "streamdown"
import { EditTaskDetailsDialog } from "./edit-task-details-dialog"

export function TaskDetailsCard({ task }: { task: Doc<"tasks"> }) {
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)
  const claimTask = useMutation(api.tasks.mutations.claimTask)
  const isWatching = useQuery(api.subscriptions.index.getSubscription, {
    object: {
      type: "tasks",
      id: task._id,
    },
  })
  const setSubscription = useMutation(api.subscriptions.index.setSubscription)
  const watchingText = isWatching ? "Subscribed" : "Watch"
  const watchingVariant = isWatching ? "ghost" : "outline"

  const dueDate = task.dueDate

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-2xl">{task.name}</CardTitle>
        <div className="flex items-center gap-1 pt-1">
          <CornerDownRightIcon className="size-4" />
          <Button variant="outline" size="sm">
            Fix Me This Should Be Parent
            <Badge variant="outline" className={cn("shrink-0 text-sm")}>
              <LoaderCircleIcon data-icon="inline-start" />
              1/3
            </Badge>
          </Button>
          <TaskDateButton
            size="sm"
            value={dueDate}
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
        <Button size="lg" onClick={() => claimTask({ id: task._id })}>
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
                id: task._id,
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
