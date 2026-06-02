import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import type {
  TaskStatusCommand,
  TaskStatusView as BackendTaskStatusView,
} from "@/convex/tasks/status/resolver"
import {
  isTaskStatusCommand,
  reorderStatusOptions,
  TASK_STATUS_META,
  TaskStatusIcon,
} from "@/features/tasks/status"
import { SelectorButton } from "./selector-face"
import * as SelectorFace from "./selector-face"
import type { ComponentProps } from "react"
import type { SelectorChangeHandler } from "./selector-options"

type TaskStatusView = Pick<
  BackendTaskStatusView,
  "effectiveStatus" | "isManuallyEditable" | "statusOptions"
>

type TaskStatusIconOptions = Omit<
  ComponentProps<typeof TaskStatusIcon>,
  "status"
>

interface TaskStatusSelectorProps extends Omit<
  ComponentProps<typeof SelectorButton>,
  "children" | "onChange"
> {
  statusView: TaskStatusView
  iconProps?: TaskStatusIconOptions
  onChange: SelectorChangeHandler<TaskStatusCommand>
}

export function Face({
  iconProps,
  showLabel,
  status,
}: {
  iconProps?: TaskStatusIconOptions
  showLabel: boolean
  status: TaskStatusCommand
}) {
  const selected = TASK_STATUS_META[status]

  return (
    <SelectorFace.Root>
      <TaskStatusIcon status={status} size="md" {...iconProps} />
      {showLabel && <SelectorFace.Text>{selected.label}</SelectorFace.Text>}
    </SelectorFace.Root>
  )
}

function TaskStatusSelectorControl({
  disabled,
  iconOnly = false,
  iconProps,
  onChange,
  showLabel,
  statusView,
  variant,
  ...props
}: TaskStatusSelectorProps & {
  iconOnly?: boolean
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
          iconOnly={iconOnly}
          variant={variant}
          {...props}
        >
          <Face iconProps={iconProps} showLabel={showLabel} status={value} />
        </SelectorButton>
      </SelectTrigger>
      <SelectContent align="end">
        {reorderStatusOptions(statusView.statusOptions).map((status) => {
          const option = TASK_STATUS_META[status]

          return (
            <SelectItem key={status} value={status}>
              <TaskStatusIcon status={status} size="sm" />
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
    <TaskStatusSelectorControl
      iconOnly
      showLabel={false}
      variant={variant}
      {...props}
    />
  )
}
