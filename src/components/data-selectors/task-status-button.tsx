import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import type {
  TaskStatusAction,
  TaskStatusCommand,
  TaskStatusView as BackendTaskStatusView,
} from "@/convex/tasks/status/resolver"
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  CircleXIcon,
  SparklesIcon,
  RotateCcwIcon,
  StampIcon,
} from "lucide-react"
import type { ElementType } from "react"

type TaskStatusView = Pick<
  BackendTaskStatusView,
  | "effectiveStatus"
  | "isManuallyEditable"
  | "statusOptions"
  | "availableActions"
>

const TASK_STATUS_META = {
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

export function TaskStatusButton({
  onChange,
  onAction,
  statusView,
}: {
  statusView: TaskStatusView
  onChange: (value: TaskStatusCommand) => void | Promise<void> | Promise<null>
  onAction?: (action: TaskStatusAction) => void | Promise<void> | Promise<null>
}) {
  const value = statusView.effectiveStatus
  const selected = TASK_STATUS_META[value]
  const SelectedIcon = selected.icon
  const isDisabled =
    !statusView.isManuallyEditable || statusView.statusOptions.length === 0
  const canReopen = statusView.availableActions.includes("reopen")
  const selectValue = statusView.statusOptions.includes(value)
    ? value
    : undefined

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Select
        disabled={isDisabled}
        value={selectValue}
        onValueChange={(next) => void onChange(next as TaskStatusCommand)}
      >
        <SelectTrigger className="min-w-0 flex-1 justify-start">
          <SelectedIcon />
          <span className="truncate">{selected.label}</span>
        </SelectTrigger>
        <SelectContent align="end">
          {statusView.statusOptions.map((status) => {
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
      {/* To-do this should likely hide the selector!
      or in this case show a popover for the complete status with the button */}
      {canReopen ? (
        <Button
          aria-label="Reopen task"
          size="icon"
          type="button"
          variant="outline"
          onClick={() => void onAction?.("reopen")}
        >
          <RotateCcwIcon />
        </Button>
      ) : null}
    </div>
  )
}
