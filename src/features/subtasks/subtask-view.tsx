import { Button } from "@/components/ui/button"
import {
  PlusIcon,
  CassetteTapeIcon,
  SquareDashedKanbanIcon,
  CircleCheck,
} from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { TaskSubtaskView } from "@/convex/tasks/queries"
import { useMutation, useQuery } from "convex/react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { SUBTASK_LIST_GRID_CLASS } from "@/features/list-views/components/list-board-columns"
import { TaskInlineDataRow } from "@/features/tasks/components/task-inline-data-row"
import type { TaskInlineRow } from "@/features/tasks/task-inline-row"
import { cn } from "@/lib/utils"

type SubtaskViewOwner = TaskSubtaskView["owner"]
type SubtaskViewSection = TaskSubtaskView["sections"][number]

const todayIso = new Date().toISOString().slice(0, 10)

function isOverdue(row: TaskInlineRow) {
  return (
    row.task.dueDate !== null &&
    row.task.dueDate < todayIso &&
    row.statusView.effectiveStatus !== "done" &&
    row.statusView.effectiveStatus !== "cancelled"
  )
}

function getSectionProgressText(section: SubtaskViewSection) {
  return `${String(section.progress.terminalComplete)}/${String(
    section.progress.total
  )}`
}

function PhaseSection({ section }: { section: SubtaskViewSection }) {
  const overdueCount = section.rows.filter(isOverdue).length

  return (
    <Collapsible
      className="group rounded-xl border bg-card text-sm data-[state=open]:pb-4"
      defaultOpen={section.progress.percent !== 100 || section.isCurrent}
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
          {overdueCount > 0 && (
            <Badge variant="destructive">{overdueCount} Overdue</Badge>
          )}
        </div>
        <Button variant="ghost" className="z-10" type="button">
          {section.progress.percent === 100 && <CircleCheck />}
          {getSectionProgressText(section)}
        </Button>
      </div>
      <CollapsibleContent>
        <div className="mt-2 border-y bg-background">
          {section.rows.length > 0 ? (
            section.rows.map((row) => (
              <div
                key={row.task._id}
                className={cn(
                  "grid min-h-12 min-w-0 items-center gap-x-3 overflow-hidden border-b px-4 py-2 last:border-b-0",
                  SUBTASK_LIST_GRID_CLASS
                )}
              >
                <TaskInlineDataRow row={row} />
              </div>
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">No tasks</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function SubtaskView({ owner }: { owner: SubtaskViewOwner }) {
  const setTaskKind = useMutation(api.tasks.mutations.setTaskKind)
  const view = useQuery(api.tasks.queries.getSubtaskView, { owner })
  const taskId = owner.type === "tasks" ? owner.id : null

  return (
    <div className="col-span-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="lg" type="button">
          <PlusIcon />
          Add Task
        </Button>
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
        <Button variant="outline" size="lg" type="button">
          <SquareDashedKanbanIcon />
          Display
        </Button>
      </div>
      {view === undefined ? (
        <div className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          Loading tasks...
        </div>
      ) : (
        view.sections.map((section) => (
          <PhaseSection key={section.id} section={section} />
        ))
      )}
    </div>
  )
}
