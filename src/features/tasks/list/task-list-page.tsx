import { Page } from "@/components/layout/page"
import { PageListMessage } from "@/components/layout/page-list-message"
import { GroupedListBoard } from "@/features/list-views/components/grouped-list-board"
import { KanbanBoard } from "@/features/list-views/components/kanban-board"
import type { DisplaySettings } from "@/features/list-views/types"
import {
  TasksFilterChips,
  TasksFilterPopover,
} from "@/features/tasks/list/task-filter-ui"
import { filterTaskRowsForListPage } from "@/features/tasks/list/task-filters"
import { groupTaskRows } from "@/features/tasks/list/task-grouping"
import { TaskListFilterBar } from "@/features/tasks/list/task-list-filter-bar"
import {
  TaskListProvider,
  useTaskListPage,
} from "@/features/tasks/list/task-list-context"
import { TaskListPageLayout } from "@/features/tasks/list/task-list-page-layout"
import {
  GLOBAL_TASK_LIST_CONFIG,
  teamTaskListConfig,
  type TaskListPageConfig,
} from "@/features/tasks/list/task-list-config"
import { TaskListNavbar } from "@/features/tasks/list/task-list-navbar"
import { sortTaskRows } from "@/features/tasks/list/task-sort"
import { TaskCard } from "@/features/tasks/list/task-card"
import { TaskRow } from "@/features/tasks/list/task-row"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { productPageTitle } from "@/lib/page-title"
import { useEffect, useMemo } from "react"

const TASK_DISPLAY_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "kind", label: "Kind" },
  { value: "assignee", label: "Assignee" },
  { value: "owner", label: "Owner" },
  { value: "competition", label: "Competition" },
  { value: "phase", label: "Phase" },
  { value: "name", label: "Name" },
  { value: "dueDate", label: "Due date" },
] as const

function effectiveKanbanGrouping(display: DisplaySettings, fallback: string) {
  if (display.mode === "kanban" && display.grouping === null) {
    return fallback
  }
  return display.grouping
}

function TaskListPageBody({
  emptyMessage,
  rows,
}: {
  emptyMessage: string
  rows: TaskBoardRow[] | undefined
}) {
  const {
    config,
    viewFilters,
    viewMatchMode,
    overlayFilters,
    overlayMatchMode,
    display,
  } = useTaskListPage()

  const groups = useMemo(() => {
    if (!rows) return []
    const visible = filterTaskRowsForListPage({
      rows,
      scope: config.scope,
      viewFilters,
      viewMatchMode,
      overlayFilters,
      overlayMatchMode,
    })
    const sorted = sortTaskRows(visible, display)
    return groupTaskRows(sorted, {
      ...display,
      grouping: effectiveKanbanGrouping(display, "status"),
    })
  }, [
    config.scope,
    display,
    overlayFilters,
    overlayMatchMode,
    rows,
    viewFilters,
    viewMatchMode,
  ])

  if (rows === undefined) {
    return <Page.Status variant="loading" message="Loading tasks…" />
  }

  if (groups.every((group) => group.items.length === 0)) {
    return (
      <div className="p-3 @sm/main:p-4">
        <PageListMessage className="rounded-xl bg-card py-10">
          {emptyMessage}
        </PageListMessage>
      </div>
    )
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

function TaskListPageContent({
  config,
  emptyMessage = "No tasks match your filters.",
}: {
  config: TaskListPageConfig
  emptyMessage?: string
}) {
  const rows = useQuery(api.tasks.board.listForBoard)

  useEffect(() => {
    document.title = productPageTitle(config.title)
  }, [config.title])

  return (
    <TaskListProvider key={config.pageId} config={config}>
      <TaskListPageLayout
        header={<TaskListNavbar />}
        filtersRow={
          <TaskListFilterBar
            filterPopover={<TasksFilterPopover rows={rows} />}
            filterChips={<TasksFilterChips rows={rows} />}
            columnOptions={[...TASK_DISPLAY_OPTIONS]}
          />
        }
      >
        <TaskListPageBody emptyMessage={emptyMessage} rows={rows} />
      </TaskListPageLayout>
    </TaskListProvider>
  )
}

export function TaskListPage({
  teamId,
  emptyMessage,
}: {
  teamId?: Id<"teams">
  emptyMessage?: string
}) {
  const team = useQuery(
    api.teams.queries.getForPage,
    teamId !== undefined ? { teamId, page: "tasks" } : "skip"
  )
  const teamConfig = useMemo(
    () =>
      team !== undefined && team !== null
        ? teamTaskListConfig(team._id, team.name)
        : null,
    [team]
  )

  if (teamId === undefined) {
    return (
      <TaskListPageContent
        config={GLOBAL_TASK_LIST_CONFIG}
        emptyMessage={emptyMessage}
      />
    )
  }

  if (team === undefined) {
    return <Page.Status variant="loading" message="Loading team tasks…" />
  }

  if (team === null) {
    return (
      <Page.Root>
        <div className="p-4">
          <PageListMessage>
            You do not have access to this team&apos;s tasks.
          </PageListMessage>
        </div>
      </Page.Root>
    )
  }

  if (teamConfig === null) {
    return <Page.Status variant="loading" message="Loading team tasks…" />
  }

  return (
    <TaskListPageContent
      config={teamConfig}
      emptyMessage={
        emptyMessage ?? "No tasks match your filters for this team."
      }
    />
  )
}
