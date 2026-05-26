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
import { SelectorButton } from "./selector-face"
import * as SelectorFace from "./selector-face"
import type { ComponentProps } from "react"
import type { SelectorChangeHandler } from "./selector-options"

type TaskStatusView = Pick<
  BackendTaskStatusView,
  "effectiveStatus" | "isManuallyEditable" | "statusOptions"
>

interface TaskStatusSelectorProps
  extends Omit<ComponentProps<typeof SelectorButton>, "children" | "onChange"> {
  statusView: TaskStatusView
  iconProps?: ComponentProps<"svg">
  onChange: SelectorChangeHandler<TaskStatusCommand>
}

function isTaskStatusCommand(value: string): value is TaskStatusCommand {
  return Object.hasOwn(TASK_STATUS_META, value)
}

export function Face({
  iconProps,
  showLabel,
  status,
}: {
  iconProps?: ComponentProps<"svg">
  showLabel: boolean
  status: TaskStatusCommand
}) {
  const selected = TASK_STATUS_META[status]
  const SelectedIcon = selected.icon

  return (
    <SelectorFace.Root>
      <SelectedIcon {...iconProps} />
      {showLabel && <SelectorFace.Text>{selected.label}</SelectorFace.Text>}
    </SelectorFace.Root>
  )
}

function TaskStatusSelectorControl({
  disabled,
  iconProps,
  onChange,
  showLabel,
  statusView,
  variant,
  ...props
}: TaskStatusSelectorProps & {
  showLabel: boolean
}) {
  const value = statusView.effectiveStatus
  const isDisabled =
    !statusView.isManuallyEditable || statusView.statusOptions.length === 0

  return (
    <Select
      disabled={isDisabled}
      value={value}
      onValueChange={(next) => {
        if (isTaskStatusCommand(next)) {
          onChange(next)
        }
      }}
    >
      <SelectTrigger asChild>
        <SelectorButton
          disabled={isDisabled || disabled}
          variant={variant}
          {...props}
        >
          <Face
            iconProps={iconProps}
            showLabel={showLabel}
            status={value}
          />
        </SelectorButton>
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

export function PropertyButton(props: TaskStatusSelectorProps) {
  return <TaskStatusSelectorControl showLabel {...props} />
}

export function CompactButton({
  size = "sm",
  ...props
}: TaskStatusSelectorProps) {
  return <TaskStatusSelectorControl showLabel size={size} {...props} />
}

export function IconButton({
  variant = "icon",
  ...props
}: TaskStatusSelectorProps) {
  return (
    <TaskStatusSelectorControl showLabel={false} variant={variant} {...props} />
  )
}
