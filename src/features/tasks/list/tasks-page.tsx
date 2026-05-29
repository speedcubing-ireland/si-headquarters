import { Card } from "@/components/ui/card"
import { GroupedListBoard } from "@/features/list-views/components/grouped-list-board"
import { KanbanBoard } from "@/features/list-views/components/kanban-board"
import type { DisplaySettings } from "@/features/list-views/types"
import {
  TasksFilterChips,
  TasksFilterPopover,
} from "@/features/tasks/list/task-filter-ui"
import { filterTaskRows } from "@/features/tasks/list/task-filters"
import { groupTaskRows } from "@/features/tasks/list/task-grouping"
import { TaskListFilterBar } from "@/features/tasks/list/task-list-filter-bar"
import { TaskListPageLayout } from "@/features/tasks/list/task-list-page-layout"
import { TaskListNavbar } from "@/features/tasks/list/task-list-navbar"
import {
  TaskListProvider,
  useTaskListPage,
} from "@/features/tasks/list/task-list-context"
import { sortTaskRows } from "@/features/tasks/list/task-sort"
import { TaskCard } from "@/features/tasks/list/task-card"
import { TaskRow } from "@/features/tasks/list/task-row"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"
import { api } from "@/convex/_generated/api"
import { useQuery } from "convex/react"
import { ListTodoIcon } from "lucide-react"
import { useMemo, type ReactNode } from "react"

const TASK_DISPLAY_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "kind", label: "Kind" },
  { value: "assignee", label: "Assignee" },
  { value: "owner", label: "Owner" },
  { value: "competition", label: "Competition" },
  { value: "phase", label: "Phase" },
  { value: "name", label: "Name" },
  { value: "dueDate", label: "Due date" },
]

const LIST_MESSAGE_CLASS =
  "m-3 px-4 py-10 text-center text-sm text-muted-foreground sm:m-4"

function ListMessage({ children }: { children: ReactNode }) {
  return <Card className={LIST_MESSAGE_CLASS}>{children}</Card>
}

function effectiveKanbanGrouping(display: DisplaySettings, fallback: string) {
  if (display.mode === "kanban" && display.grouping === null) {
    return fallback
  }
  return display.grouping
}

function TasksPageBody() {
  const { filters, matchMode, display } = useTaskListPage()
  const rows = useQuery(api.tasks.board.listForBoard)

  const groups = useMemo(() => {
    if (!rows) return []
    const visible = filterTaskRows(rows, filters, matchMode)
    const sorted = sortTaskRows(visible, display)
    return groupTaskRows(sorted, {
      ...display,
      grouping: effectiveKanbanGrouping(display, "status"),
    })
  }, [display, filters, matchMode, rows])

  if (rows === undefined) {
    return <ListMessage>Loading tasks…</ListMessage>
  }

  if (groups.every((group) => group.items.length === 0)) {
    return <ListMessage>No tasks match your filters.</ListMessage>
  }

  if (display.mode === "kanban") {
    return (
      <KanbanBoard
        groups={groups}
        renderCard={(row: TaskBoardRow) => <TaskCard row={row} />}
        getItemKey={(row) => row.task._id}
        emptyLabel="No tasks in this column"
      />
    )
  }

  return (
    <GroupedListBoard
      groups={groups}
      renderRow={(row) => <TaskRow row={row} />}
      getRowKey={(row) => row.task._id}
      itemLabel={(count) => `${String(count)} task${count === 1 ? "" : "s"}`}
    />
  )
}

export function TasksPage() {
  return (
    <TaskListProvider pageId="all">
      <TaskListPageLayout
        header={<TaskListNavbar icon={ListTodoIcon} title="All tasks" />}
        filtersRow={
          <TaskListFilterBar
            filterPopover={<TasksFilterPopover />}
            filterChips={<TasksFilterChips />}
            columnOptions={TASK_DISPLAY_OPTIONS}
          />
        }
      >
        <TasksPageBody />
      </TaskListPageLayout>
    </TaskListProvider>
  )
}
