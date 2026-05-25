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
import { cn } from "@/lib/utils"

type TaskStatusView = Pick<
  BackendTaskStatusView,
  "effectiveStatus" | "isManuallyEditable" | "statusOptions"
>

export function TaskStatusButton({
  onChange,
  size,
  statusView,
  className,
}: {
  statusView: TaskStatusView
  size?: "sm" | "default"
  onChange: (value: TaskStatusCommand) => void | Promise<void> | Promise<null>
  className?: string
}) {
  const value = statusView.effectiveStatus
  const selected = TASK_STATUS_META[value]
  const SelectedIcon = selected.icon
  const isDisabled =
    !statusView.isManuallyEditable || statusView.statusOptions.length === 0

  return (
    <Select
      disabled={isDisabled}
      value={value.toString()}
      onValueChange={(next) => {
        void onChange(next as TaskStatusCommand)
      }}
    >
      <SelectTrigger
        size={size}
        className={cn("min-w-0 justify-start", className)}
        hideChevron
      >
        <SelectedIcon />
        <span className="truncate">{selected.label}</span>
      </SelectTrigger>
      <SelectContent align="end">
        {reorderStatusOptions(statusView.statusOptions).map((status) => {
          const option = TASK_STATUS_META[status]
          const Icon = option.icon

          return (
            <SelectItem key={status} value={status.toString()}>
              <Icon />
              {option.label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
