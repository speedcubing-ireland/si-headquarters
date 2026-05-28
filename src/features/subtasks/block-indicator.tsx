import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { BlockerCounts } from "@/convex/tasks/blockers/counts"
import { formatBlockedByTooltip } from "@/features/subtasks/block-indicator-tooltip"
import { cn } from "@/lib/utils"
import { ArrowRightToLineIcon } from "lucide-react"

export function BlockIndicator({
  count,
  openCount,
  blockedBy,
  className,
}: BlockerCounts & { className?: string }) {
  if (count === 0) return null

  const tooltip = formatBlockedByTooltip(blockedBy)
  const hasOpenBlockers = openCount > 0

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={hasOpenBlockers ? "destructive" : "outline"}
          className={cn("px-1.5", className)}
          aria-label={tooltip}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
        >
          <ArrowRightToLineIcon data-icon="inline-start" />
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
