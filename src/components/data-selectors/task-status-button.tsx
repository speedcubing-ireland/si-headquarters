import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  reorderStatusOptions,
  TASK_STATUS_META,
} from "@/components/data-selectors/task-status-meta"
import type {
  TaskStatusCommand,
  TaskStatusView as BackendTaskStatusView,
} from "@/convex/tasks/status/resolver"
import { Button } from "../ui/button"

function isTaskStatusCommand(value: string): value is TaskStatusCommand {
  return Object.hasOwn(TASK_STATUS_META, value)
}

type TaskStatusView = Pick<
  BackendTaskStatusView,
  "effectiveStatus" | "isManuallyEditable" | "statusOptions"
>

export function TaskStatusButton({
  onChange,
  showLabel = true,
  iconProps,
  statusView,
  ...props
}: {
  statusView: TaskStatusView
  showLabel?: boolean
  iconProps?: React.ComponentProps<"svg">
  onChange: (value: TaskStatusCommand) => Promise<null> | undefined
} & Omit<React.ComponentProps<typeof Button>, "onChange">) {
  const value = statusView.effectiveStatus
  const selected = TASK_STATUS_META[value]
  const SelectedIcon = selected.icon
  const isDisabled =
    !statusView.isManuallyEditable || statusView.statusOptions.length === 0

  return (
    <Select
      disabled={isDisabled}
      value={value}
      onValueChange={(next) => {
        if (isTaskStatusCommand(next)) {
          void onChange(next)
        }
      }}
    >
      <SelectTrigger
        asChild
      >
        <Button
          variant={props.variant ?? "outline"}
          disabled={isDisabled || props.disabled}
          {...props}
        >
          <SelectedIcon {...iconProps} />
          {showLabel && <span className="truncate">{selected.label}</span>}
        </Button>
      </SelectTrigger>
      <SelectContent align="end">
        {reorderStatusOptions(statusView.statusOptions).map((status) => {
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
