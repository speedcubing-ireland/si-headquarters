import type { TaskStatusCommand } from "@/convex/tasks/status/resolver"
import type { TaskStatus } from "@/convex/tasks/status/validators"
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  CircleXIcon,
  SparklesIcon,
  StampIcon,
} from "lucide-react"
import type { ElementType } from "react"

export const TASK_STATUS_META = {
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
  auto: {
    label: "Auto set",
    icon: SparklesIcon,
  },
} satisfies Record<TaskStatusCommand, { label: string; icon: ElementType }>

const orderedStatusOptions = [
  "auto",
  "backlog",
  "to-do",
  "in-progress",
  "awaiting-review",
  "done",
  "cancelled",
] satisfies TaskStatusCommand[]

const TASK_STATUS_ICON_CLASS: Record<TaskStatus, string> = {
  backlog: "text-muted-foreground",
  "to-do": "text-muted-foreground",
  "in-progress": "text-yellow-600",
  "awaiting-review": "text-muted-foreground",
  done: "text-emerald-600",
  cancelled: "text-emerald-600",
}

export function getTaskStatusIconClassName(status: TaskStatus) {
  return TASK_STATUS_ICON_CLASS[status]
}

export function reorderStatusOptions(
  options: TaskStatusCommand[]
): TaskStatusCommand[] {
  const optionSet = new Set(options)
  const orderedOptions: TaskStatusCommand[] = []

  for (const status of orderedStatusOptions) {
    if (optionSet.has(status)) {
      orderedOptions.push(status)
    }
  }

  return orderedOptions
}
