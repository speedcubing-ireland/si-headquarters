import { Button } from "@/components/ui/button"
import { PlusIcon, CassetteTapeIcon, CircleCheck } from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { TaskSubtaskView } from "@/convex/tasks/queries"
import { getProgress } from "@/convex/tasks/status/rules"
import { useMutation, useQuery } from "convex/react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { SUBTASK_LIST_GRID_CLASS } from "@/features/list-views/components/list-board-columns"
import { SubtaskDisplayOptionsPopover } from "@/features/subtasks/subtask-display-options"
import {
  readSubtaskDisplayOptions,
  writeSubtaskDisplayOptions,
  type SubtaskDisplayOptions,
} from "@/features/subtasks/subtask-display-storage"
import { TaskInlineDataRow } from "@/features/tasks/components/task-inline-data-row"
import { AddTaskDialog } from "@/features/tasks/components/add-task-dialog"
import { isTerminalRowStatus } from "@/features/tasks/task-row-status"
import type { TaskInlineRow } from "@/features/tasks/task-inline-row"
import { cn } from "@/lib/utils"
import { useEffect, useState, type ReactNode } from "react"
import { EditTasksDialog } from "@/features/subtasks/edit-tasks-dialog"

type SubtaskViewOwner = TaskSubtaskView["owner"]
type SubtaskViewSection = TaskSubtaskView["sections"][number]

function isDirectSubtaskRow(row: TaskInlineRow) {
  return row.path.depth === 0
}

function filterRows(
  rows: TaskInlineRow[],
  displayOptions: SubtaskDisplayOptions
) {
  return rows.filter((row) => {
    if (
      displayOptions.hideCompleted &&
      isTerminalRowStatus(row.statusView.effectiveStatus)
    ) {
      return false
    }
    if (displayOptions.hideSubtasks && !isDirectSubtaskRow(row)) return false
    return true
  })
}

function getVisibleSection(
  section: SubtaskViewSection,
  displayOptions: SubtaskDisplayOptions
) {
  const rows = filterRows(section.rows, displayOptions)
  const statuses = rows.map((row) => row.statusView.effectiveStatus)

  return {
    rows,
    progress: getProgress(statuses),
    overdueCount: section.overdueCount,
  }
}

function getSectionProgressText(progress: SubtaskViewSection["progress"]) {
  return `${String(progress.terminalComplete)}/${String(progress.total)}`
}

function PhaseSection({
  displayOptions,
  section,
}: {
  displayOptions: SubtaskDisplayOptions
  section: SubtaskViewSection
}) {
  const visible = getVisibleSection(section, displayOptions)

  return (
    <Collapsible
      className="group rounded-xl border bg-card text-sm data-[state=open]:pb-4"
      defaultOpen={visible.progress.percent !== 100 || section.isCurrent}
    >
      <div className="relative flex items-center gap-4 px-4 group-data-[state=closed]:py-2 group-data-[state=open]:pt-2">
        <CollapsibleTrigger
          aria-label={`Toggle ${section.title}`}
          className="absolute inset-0"
        />
        <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-4">
          <h3 className="font-heading text-base leading-snug font-semibold">
            {section.title}
          </h3>
          {section.isCurrent && <Badge>Current</Badge>}
          {visible.overdueCount > 0 && (
            <Badge variant="destructive">{visible.overdueCount} Overdue</Badge>
          )}
        </div>
        <Button variant="ghost" className="z-10" type="button">
          {visible.progress.percent === 100 && <CircleCheck />}
          {getSectionProgressText(visible.progress)}
        </Button>
      </div>
      <CollapsibleContent>
        <div className="mt-2 border-y bg-background">
          {visible.rows.length > 0 ? (
            visible.rows.map((row) => (
              <div
                key={row.task._id}
                className={cn(
                  "grid min-h-12 min-w-0 items-center gap-x-1 overflow-hidden border-b px-4 py-2 last:border-b-0",
                  SUBTASK_LIST_GRID_CLASS
                )}
              >
                <TaskInlineDataRow row={row} />
              </div>
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {section.rows.length > 0 ? "No visible tasks" : "No tasks"}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function SubtaskView({
  owner,
  toolbarActions,
}: {
  owner: SubtaskViewOwner
  toolbarActions?: ReactNode
}) {
  const setTaskKind = useMutation(api.tasks.mutations.setTaskKind)
  const view = useQuery(api.tasks.queries.getSubtaskView, { owner })
  const [displayOptions, setDisplayOptions] = useState(
    readSubtaskDisplayOptions
  )
  const taskId = owner.type === "tasks" ? owner.id : null

  useEffect(() => {
    writeSubtaskDisplayOptions(displayOptions)
  }, [displayOptions])

  if (view === undefined) {
    return null
  }

  return (
    <div className="col-span-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AddTaskDialog initialParent={view.defaultParent} parentScope={owner}>
          <Button variant="outline" size="lg" type="button">
            <PlusIcon />
            Add Task
          </Button>
        </AddTaskDialog>
        <EditTasksDialog sections={view.sections} />
        {toolbarActions}
        {taskId !== null && (
          <Button
            variant="outline"
            size="lg"
            type="button"
            onClick={() => {
              void setTaskKind({ id: taskId, kind: "flow" })
            }}
          >
            <CassetteTapeIcon />
            Create Flow
          </Button>
        )}
        <div className="flex-1" />
        <SubtaskDisplayOptionsPopover
          options={displayOptions}
          onChange={setDisplayOptions}
        />
      </div>
      {view.sections.map((section) => (
        <PhaseSection
          key={section.id}
          displayOptions={displayOptions}
          section={section}
        />
      ))}
    </div>
  )
}
