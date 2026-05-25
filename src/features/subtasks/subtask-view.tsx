import { Button } from "@/components/ui/button"
import {
  PlusIcon,
  CassetteTapeIcon,
  SquareDashedKanbanIcon,
  CircleCheck,
} from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useMutation } from "convex/react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { TaskDateButton } from "@/components/data-selectors/task-date-button"
import { TaskOwnerButton } from "@/components/data-selectors/task-owner-button"
import { TaskStatusButton } from "@/components/data-selectors/task-status-button"
import { UserButton } from "@/components/data-selectors/user-button"
import type { PublicUser } from "@/convex/users/validators"


interface InlineDataRow {
  id: Id<"tasks">
  owner: Doc<"tasks">["owner"]
  statusView: Parameters<typeof TaskStatusButton>[0]["statusView"] // this type will be cleanly gotten when we do the backend
  assignees: PublicUser[]
  assigneeAvatarUrl: string
  taskTitle: string
  subtaskTitle: string
  subtaskIndicator: string
  labels: string[]
  dueDate: string
  ownerAvatarUrl: string
}

function InlineDataViewRow({ row }: { row: InlineDataRow }) {
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)
  const setTaskOwner = useMutation(api.tasks.mutations.setTaskOwner);
  const setTaskStatus = useMutation(api.tasks.mutations.setTaskStatus);
  const setAssignees = useMutation(api.tasks.mutations.setTaskAssignees);
  
  return (
    <div className="flex min-w-0 items-center gap-3 border-b px-2 py-3 last:border-b-0">
      <p className="shrink-0 font-mono text-muted-foreground">{row.id}</p>
      <UserButton
        selectionMode="multiple"
        selectedUsers={row.assignees}
        value={row.assignees.map((user) => user._id)}
        onChange={(assigneeIds) => {
          void setAssignees({
            id: row.id,
            assigneeIds,
          })
        }}
        variant="icon"
        showName={false}
        avatarProps={{ className: "size-5", size: "default" }}
      />
      <TaskStatusButton
        statusView={row.statusView}
        onChange={(newStatus) => {
          return setTaskStatus({ id: row.id, status: newStatus })
        }}
        showLabel={false}
        iconProps={{ className: "size-5" }}
        variant="icon"
      />
      {/* <ResponsiveTaskPath
        taskTitle={row.taskTitle}
        subtaskTitle={row.subtaskTitle}
        subtaskIndicator={row.subtaskIndicator}
        labels={row.labels}
      /> */}
      <TaskDateButton
        variant="icon"
        value={row.dueDate}
        onChange={(newDate) => {
          return setDueDate({ id: row.id, dueDate: newDate })
        }}
        className="font-mono text-muted-foreground"
        showIcon={false}
      />
      <TaskOwnerButton
        value={row.owner}
        onChange={(newOwner) => {
          return setTaskOwner({ id: row.id, owner: newOwner })
        }}
        variant="icon"
        showName={false}
        avatarProps={{ className: "size-5", size: "default" }}
      />
    </div>
  )
}

function PhaseSection({ phase }: { phase: string }) {
  const current = phase === "Pre-Announcement"
  const overdue = phase === "Concept"
  return (
    <Collapsible
      className="group rounded-xl border bg-card text-sm data-[state=open]:pb-4"
      defaultOpen  
    >
      <div className="relative flex items-center gap-4 px-4 group-data-[state=closed]:py-2 group-data-[state=open]:pt-2">
        <CollapsibleTrigger
          aria-label={`Toggle ${phase}`}
          className="absolute inset-0"
        />
        <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-4">
          <h3 className="font-heading text-base leading-snug font-semibold">
            {phase}
          </h3>
          {current && <Badge>Current</Badge>}
          {overdue && <Badge variant="destructive">3 Overdue</Badge>}
        </div>
        <Button variant="ghost" className="z-10">
          <CircleCheck />
          Feb 12
        </Button>
      </div>
      <CollapsibleContent>
        <div className="mt-2 border-y bg-background">
          {/* {demoRows.map((row) => (
            <InlineDataViewRow key={row.id} row={row} />
          ))} */}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function SubtaskView({ taskId }: { taskId: Id<"tasks"> }) {
  const setTaskKind = useMutation(api.tasks.mutations.setTaskKind)
  
  return (
    <div className="col-span-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="lg">
          <PlusIcon />
          Add Task
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            void setTaskKind({ id: taskId, kind: "flow" })
          }}
        >
          <CassetteTapeIcon />
          Create Flow
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="lg">
          <SquareDashedKanbanIcon />
          Display
        </Button>
      </div>
      <PhaseSection phase="Subtasks" />
    </div>
  )
}
