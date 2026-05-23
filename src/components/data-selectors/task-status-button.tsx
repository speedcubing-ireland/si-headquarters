/*
To-do - High Priority
This needs to be reworked
The available status should be send via the server based on the task state
The icons and names etc. should be in a static data file with type safety against the backend
*/

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  BotIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  CircleXIcon,
  StampIcon,
} from "lucide-react"
import type { ElementType } from "react"

type TaskStatus = Doc<"tasks">["status"]

const TASK_STATUS_OPTIONS = [
  "backlog",
  "to-do",
  "in-progress",
  "awaiting-review",
  "done",
  "cancelled",
] as const satisfies TaskStatus[]

const TASK_STATUS_META = {
  computed: {
    label: "Computed",
    icon: BotIcon,
  },
  backlog: {
    label: "Backlog",
    icon: CircleDashedIcon,
  },
  "to-do": {
    label: "To-do",
    icon: CircleIcon,
  },
  "in-progress": {
    label: "In progress",
    icon: CircleDotIcon,
  },
  "awaiting-review": {
    label: "Awaiting review",
    icon: StampIcon,
  },
  done: {
    label: "Done",
    icon: CircleCheckIcon,
  },
  cancelled: {
    label: "Cancelled",
    icon: CircleXIcon,
  },
} satisfies Record<TaskStatus, { label: string; icon: ElementType }>

export function TaskStatusButton({
  onChange,
  value,
}: {
  value: TaskStatus
  onChange: (value: TaskStatus) => void | Promise<void> | Promise<null>
}) {
  const selected = TASK_STATUS_META[value]
  const SelectedIcon = selected.icon

  return (
    <Select
      value={value}
      onValueChange={(next) => void onChange(next as TaskStatus)}
    >
      <SelectTrigger className="justify-start">
        <SelectedIcon />
        <SelectValue>{selected.label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {TASK_STATUS_OPTIONS.map((status) => {
          const option = TASK_STATUS_META[status]
          const Icon = option.icon

          return (
            <SelectItem key={status} value={status}>
              <Icon />
              {option.label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
