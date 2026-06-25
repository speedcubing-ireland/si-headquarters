import type { BlockerCounts } from "@/convex/tasks/blockers/counts"
import { cn } from "@/lib/utils"
import { BlockIndicator } from "./block-indicator"
import { SubtaskBadge } from "./subtask-badge"
import type { TaskInlineIndicatorProps } from "./task-inline-indicator-props"

const compactIndicatorBadgeClassName =
  "inline-flex h-5 shrink-0 items-center gap-0.5 self-center py-0 text-xs leading-none"

const emptyBlockers = {
  count: 0,
  openCount: 0,
  blockingCount: 0,
  blockedBy: [],
} satisfies BlockerCounts

export function TaskInlineIndicators({
  blockers = emptyBlockers,
  className,
  kind,
  progress,
  subtaskSummary,
}: TaskInlineIndicatorProps) {
  if (progress.total === 0 && blockers.openCount === 0) return null

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      <SubtaskBadge
        kind={kind}
        progress={progress}
        subtaskSummary={subtaskSummary}
        className={compactIndicatorBadgeClassName}
      />
      <BlockIndicator
        {...blockers}
        className={compactIndicatorBadgeClassName}
      />
    </span>
  )
}
