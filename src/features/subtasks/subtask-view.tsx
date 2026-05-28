import { Button } from "@/components/ui/button"
import {
  PlusIcon,
  CassetteTapeIcon,
  SquareDashedKanbanIcon,
  CircleCheck,
  ChevronRightIcon,
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
import * as TaskDateSelector from "@/components/data-selectors/task-date-selector"
import * as TaskOwnerSelector from "@/components/data-selectors/task-owner-selector"
import * as TaskStatusSelector from "@/components/data-selectors/task-status-selector"
import * as UserSelector from "@/components/data-selectors/user-selector"
import { useMeasuredElement } from "@/hooks/use-measured-element"
import {
  buildTaskPathCandidates,
  DEFAULT_TASK_PATH_FONT,
  getCompactLabelText,
  selectTaskPathLayout,
} from "@/components/data-views/task-path-layout"
import { useMemo } from "react"
import { BlockIndicator } from "./block-indicator"
import { SubtaskBadge } from "./subtask-badge"

type SubtaskViewOwner = TaskSubtaskView["owner"]
type SubtaskViewSection = TaskSubtaskView["sections"][number]
type InlineDataRow = SubtaskViewSection["rows"][number]

const todayIso = new Date().toISOString().slice(0, 10)

function isOverdue(row: InlineDataRow) {
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

function ResponsiveTaskPath({ row }: { row: InlineDataRow }) {
  const [rootRef, rootMeasurement] = useMeasuredElement(DEFAULT_TASK_PATH_FONT)
  const labelText = row.labels[0]?.name ?? ""
  const compactLabelText =
    row.labels.length > 0 ? getCompactLabelText(row.labels.length) : ""
  const candidates = useMemo(
    () =>
      buildTaskPathCandidates({
        taskTitle: row.path.taskTitle,
        subtaskTitle: row.path.subtaskTitle,
        subtaskIndicator: row.path.subtaskIndicator,
        hasBlockIndicator: row.blockers.count > 0,
        labelText,
        compactLabelText,
        textFont: rootMeasurement.font,
      }),
    [
      compactLabelText,
      labelText,
      rootMeasurement.font,
      row.path.subtaskIndicator,
      row.path.subtaskTitle,
      row.blockers.count,
      row.path.taskTitle,
    ]
  )
  const layout = useMemo(
    () => selectTaskPathLayout(candidates, rootMeasurement.width),
    [candidates, rootMeasurement.width]
  )

  return (
    <div
      ref={rootRef}
      className="flex min-w-0 flex-1 items-center overflow-hidden"
    >
      <div className="flex min-w-0 shrink-0 items-center gap-1">
        <span className="shrink-0 whitespace-nowrap" title={row.path.taskTitle}>
          {layout.taskText}
        </span>
        {row.path.subtaskTitle.length > 0 && (
          <>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
            <span
              className="shrink-0 whitespace-nowrap text-muted-foreground"
              title={row.path.subtaskTitle}
            >
              {layout.subtaskText}
            </span>
          </>
        )}
        <SubtaskBadge
          kind={row.task.kind}
          progress={row.statusView.progress}
          className="shrink-0 text-sm"
        />
        <BlockIndicator {...row.blockers} className="shrink-0 text-sm" />
      </div>
      {labelText.length > 0 && (
        <Button
          variant="icon"
          className="ml-auto shrink-0"
          aria-label={labelText}
        >
          <Badge
            className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
            title={labelText}
          >
            {layout.labelText}
          </Badge>
        </Button>
      )}
    </div>
  )
}

function InlineDataViewRow({ row }: { row: InlineDataRow }) {
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)
  const setTaskOwner = useMutation(api.tasks.mutations.setTaskOwner)
  const setTaskStatus = useMutation(api.tasks.mutations.setTaskStatus)
  const setAssignees = useMutation(api.tasks.mutations.setTaskAssignees)

  return (
    <div className="flex min-w-0 items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <UserSelector.MultiIconButton
        selectedUsers={row.assignees.users}
        value={row.assignees.userIds}
        onChange={(assigneeIds) => {
          void setAssignees({
            id: row.task._id,
            assigneeIds,
          })
        }}
        avatarProps={{ className: "size-5", size: "default" }}
      />
      <TaskStatusSelector.IconButton
        statusView={row.statusView}
        onChange={(newStatus) => {
          void setTaskStatus({ id: row.task._id, status: newStatus })
        }}
        iconProps={{ className: "size-5" }}
      />
      <ResponsiveTaskPath row={row} />
      <TaskDateSelector.InlineTextButton
        value={row.task.dueDate}
        onChange={(newDate) => {
          void setDueDate({ id: row.task._id, dueDate: newDate })
        }}
        className="font-mono text-muted-foreground"
      />
      <TaskOwnerSelector.IconButton
        selectedOwner={row.owner}
        onChange={(newOwner) => {
          void setTaskOwner({ id: row.task._id, owner: newOwner })
        }}
        avatarProps={{ className: "size-5", size: "default" }}
      />
    </div>
  )
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
              <InlineDataViewRow key={row.task._id} row={row} />
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
