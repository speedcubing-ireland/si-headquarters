import type { BlockerCounts } from "@/convex/tasks/blockers/counts"
import type {
  TaskViewProgress,
  TaskViewSubtaskSummary,
} from "@/convex/tasks/view"
import type { TaskKind } from "@/convex/tasks/status/resolver"

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
