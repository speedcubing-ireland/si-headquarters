import type { BlockerCounts } from "@/convex/tasks/blockers/counts"
import type { TaskViewProgress, TaskViewSubtaskSummary } from "@/convex/tasks/view"
import type { TaskKind } from "@/convex/tasks/status/resolver"
import { cn } from "@/lib/utils"
import { BlockIndicator } from "./block-indicator"
import { SubtaskBadge } from "./subtask-badge"

const compactIndicatorBadgeClassName =
  "inline-flex h-5 shrink-0 items-center gap-0.5 self-center py-0 text-xs leading-none"

const emptyBlockers = {
  count: 0,
  openCount: 0,
  blockedBy: [],
} satisfies BlockerCounts

export interface TaskInlineIndicatorProps {
  blockers?: BlockerCounts
  className?: string
  kind: TaskKind
  progress: TaskViewProgress
  subtaskSummary: TaskViewSubtaskSummary
}

export function taskInlineIndicatorPropsFromRow(row: {
  task: { kind: TaskKind }
  statusView: { progress: TaskViewProgress }
  blockers: BlockerCounts
  subtaskSummary: TaskViewSubtaskSummary
}): TaskInlineIndicatorProps {
  return {
    kind: row.task.kind,
    progress: row.statusView.progress,
    blockers: row.blockers,
    subtaskSummary: row.subtaskSummary,
  }
}

export function TaskInlineIndicators({
  blockers = emptyBlockers,
  className,
  kind,
  progress,
  subtaskSummary,
}: TaskInlineIndicatorProps) {
  if (progress.total === 0 && blockers.count === 0) return null

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
