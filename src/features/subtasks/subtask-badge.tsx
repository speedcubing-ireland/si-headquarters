import { CassetteTapeIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { TaskViewProgress, TaskViewSubtaskSummary } from "@/convex/tasks/view"
import type { TaskKind } from "@/convex/tasks/status/resolver"
import type { ComponentProps } from "react"
import { SubtaskSummaryTooltipContent } from "./subtask-summary-tooltip"

const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 6

function ProgressIcon({
  done,
  total,
  className,
  ...props
}: ComponentProps<"svg"> & {
  done: number
  total: number
}) {
  return (
    <svg
      className={cn("size-3", className)}
      viewBox="0 0 16 16"
      fill="none"
      {...props}
    >
      <title>Subtask progress</title>
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.3"
      />
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={`${String((done / total) * CIRCLE_CIRCUMFERENCE)} ${String(CIRCLE_CIRCUMFERENCE)}`}
        strokeLinecap="round"
        transform="rotate(-90 8 8)"
      />
    </svg>
  )
}

export function SubtaskBadge({
  kind,
  progress,
  subtaskSummary,
  className,
}: {
  kind: TaskKind
  progress: TaskViewProgress
  subtaskSummary: TaskViewSubtaskSummary
  className?: string
}) {
  const subtaskCount = progress.total
  if (subtaskCount === 0) return null

  const badge = (
    <Badge
      variant="outline"
      className={cn("text-sm", className ?? "hidden @sm/main:flex")}
      aria-label={`Subtask progress ${String(progress.done)} of ${String(
        progress.total
      )}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
    >
      {kind === "standard" && (
        <ProgressIcon
          done={progress.done}
          total={progress.total}
          data-icon="inline-start"
        />
      )}
      {kind === "flow" && <CassetteTapeIcon data-icon="inline-start" />}
      {`${String(progress.done)}/${String(progress.total)}`}
    </Badge>
  )

  if (subtaskSummary.length === 0) return badge

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="block max-w-80">
        <SubtaskSummaryTooltipContent summary={subtaskSummary} />
      </TooltipContent>
    </Tooltip>
  )
}
