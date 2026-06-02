import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { ReactElement, ReactNode } from "react"
import {
  formatTaskLabelCount,
  type TaskLabelOption,
} from "./task-label-display"

type TaskLabelColor = TaskLabelOption["color"]

const labelBadgeVariants = {
  slate:
    "border-task-label-slate-border bg-task-label-slate-bg text-task-label-slate-fg",
  rose: "border-task-label-rose-border bg-task-label-rose-bg text-task-label-rose-fg",
  amber:
    "border-task-label-amber-border bg-task-label-amber-bg text-task-label-amber-fg",
  emerald:
    "border-task-label-emerald-border bg-task-label-emerald-bg text-task-label-emerald-fg",
  teal: "border-task-label-teal-border bg-task-label-teal-bg text-task-label-teal-fg",
  sky: "border-task-label-sky-border bg-task-label-sky-bg text-task-label-sky-fg",
  indigo:
    "border-task-label-indigo-border bg-task-label-indigo-bg text-task-label-indigo-fg",
  violet:
    "border-task-label-violet-border bg-task-label-violet-bg text-task-label-violet-fg",
} satisfies Record<TaskLabelColor, string>

function getTaskLabelBadgeVariant(color: TaskLabelColor): string {
  return labelBadgeVariants[color]
}

export function LabelBadge({
  children,
  className,
  label,
}: {
  children?: ReactNode
  className?: string
  label: Pick<TaskLabelOption, "name" | "color">
}) {
  return (
    <Badge
      className={cn("border", getTaskLabelBadgeVariant(label.color), className)}
    >
      {children ?? label.name}
    </Badge>
  )
}

export function LabelCountBadge({
  children,
  className,
  count,
}: {
  children?: ReactNode
  className?: string
  count: number
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border-border bg-muted text-muted-foreground", className)}
    >
      {children ?? formatTaskLabelCount(count)}
    </Badge>
  )
}

export function LabelListTooltip({
  children,
  labels,
}: {
  children: ReactElement
  labels: Pick<TaskLabelOption, "_id" | "name">[]
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="block">
        <ul className="space-y-1 text-left">
          {labels.map((label) => (
            <li key={label._id}>{label.name}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}
