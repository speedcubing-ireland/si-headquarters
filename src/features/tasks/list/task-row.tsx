import { TaskCompLink } from "@/features/tasks/components/task-comp-link"
import { TaskInlineDataRow } from "@/features/tasks/components/task-inline-data-row"
import { TASK_LIST_GRID_CLASS } from "@/features/list-views/components/list-board-columns"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"
import { cn } from "@/lib/utils"

export function TaskRow({ row }: { row: TaskBoardRow }) {
  return (
    <div
      className={cn(
        "grid min-h-9 min-w-0 items-center gap-x-1.5 px-4 py-1.5",
        TASK_LIST_GRID_CLASS
      )}
    >
      <TaskCompLink row={row} className="justify-self-start" />
      <TaskInlineDataRow row={row} />
    </div>
  )
}
