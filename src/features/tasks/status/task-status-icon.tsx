import type { TaskStatusCommand } from "@/convex/tasks/status/resolver"
import type { TaskStatus } from "@/convex/tasks/status/validators"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"
import { getTaskStatusIconClassName, type TaskStatusIconTone } from "./colors"
import { getTaskStatusLabel, TASK_STATUS_META } from "./meta"

const SIZE_CLASS = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const

export function TaskStatusIcon({
  status,
  size = "md",
  tone = "status",
  className,
  ...props
}: ComponentProps<"svg"> & {
  status: TaskStatus | TaskStatusCommand
  size?: keyof typeof SIZE_CLASS
  tone?: TaskStatusIconTone
}) {
  const Icon = TASK_STATUS_META[status].icon

  return (
    <Icon
      aria-label={getTaskStatusLabel(status)}
      className={cn(
        SIZE_CLASS[size],
        getTaskStatusIconClassName(status, tone),
        className
      )}
      {...props}
    />
  )
}
