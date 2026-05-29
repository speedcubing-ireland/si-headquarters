import { Button } from "@/components/ui/button"
import { useMeasuredElement } from "@/hooks/use-measured-element"
import {
  CassetteTapeIcon,
  ChevronRightIcon,
  CircleCheck,
  CircleDotIcon,
  LoaderCircleIcon,
  PlusIcon,
  SquareDashedKanbanIcon,
} from "lucide-react"
import { useMemo } from "react"
import { Avatar, AvatarImage } from "../ui/avatar"
import { Badge } from "../ui/badge"
import {
  buildTaskPathCandidates,
  DEFAULT_TASK_PATH_FONT,
  getCompactLabelText,
  selectTaskPathLayout,
} from "./task-path-layout"
import { cn } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible"

interface InlineDataRow {
  id: string
  assigneeAvatarUrl: string
  taskTitle: string
  subtaskTitle: string
  subtaskIndicator: string
  labels: string[]
  dueDate: string
  ownerAvatarUrl: string
}

type ResponsiveTaskPathProps = Pick<
  InlineDataRow,
  "taskTitle" | "subtaskTitle" | "subtaskIndicator" | "labels"
>

const demoRows: InlineDataRow[] = [
  {
    id: "#133",
    assigneeAvatarUrl: "https://github.com/simonkellly.png",
    taskTitle: "Design Certificate Background",
    subtaskTitle: "Design Certs",
    subtaskIndicator: "1/3",
    labels: ["Certificates"],
    dueDate: "Aug 18",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=C T",
  },
  {
    id: "#134",
    assigneeAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=A R",
    taskTitle: "Publish Registration Pack",
    subtaskTitle: "Review Long-Form Eligibility Copy",
    subtaskIndicator: "2/5",
    labels: ["Operations"],
    dueDate: "Aug 22",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=O P",
  },
  {
    id: "#135",
    assigneeAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=M K",
    taskTitle: "Confirm Venue Floorplan",
    subtaskTitle: "Fire Exit Signage",
    subtaskIndicator: "4/4",
    labels: ["Venue"],
    dueDate: "Sep 02",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=V N",
  },
]

function PhaseSection({ phase }: { phase: string }) {
  const current = phase === "Pre-Announcement"
  const overdue = phase === "Concept"
  return (
    <Collapsible className="group rounded-xl border bg-card text-sm data-[state=open]:pb-4">
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
          {demoRows.map((row) => (
            <InlineDataViewRow key={row.id} row={row} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function InlineDataView() {
  return (
    <div className="col-span-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="lg">
          <PlusIcon />
          Add Task
        </Button>
        <Button variant="outline" size="lg">
          <SquareDashedKanbanIcon />
          Display
        </Button>
      </div>
      <PhaseSection phase="Concept" />
      <PhaseSection phase="Pre-Announcement" />
      <PhaseSection phase="Announced" />
      <PhaseSection phase="Pre-Competition" />
      <PhaseSection phase="Post-Competition" />
    </div>
  )
}

function InlineDataViewRow({ row }: { row: InlineDataRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b px-2 py-3 last:border-b-0">
      <p className="shrink-0 font-mono text-muted-foreground">{row.id}</p>
      <Button variant="icon" aria-label={`${row.id} assignee`}>
        <Avatar className="size-5">
          <AvatarImage src={row.assigneeAvatarUrl} />
        </Avatar>
      </Button>
      <Button variant="icon" aria-label={`${row.id} status`}>
        <CircleDotIcon className="size-5" />
      </Button>
      <ResponsiveTaskPath
        taskTitle={row.taskTitle}
        subtaskTitle={row.subtaskTitle}
        subtaskIndicator={row.subtaskIndicator}
        labels={row.labels}
      />
      <Button variant="icon" aria-label={`${row.id} due date`}>
        <p className="font-mono text-muted-foreground">{row.dueDate}</p>
      </Button>
      <Button variant="icon" aria-label={`${row.id} owner`}>
        <Avatar className="size-5">
          <AvatarImage src={row.ownerAvatarUrl} />
        </Avatar>
      </Button>
    </div>
  )
}

function ResponsiveTaskPath({
  taskTitle,
  subtaskTitle,
  subtaskIndicator,
  labels,
}: ResponsiveTaskPathProps) {
  const [rootRef, rootMeasurement] = useMeasuredElement(DEFAULT_TASK_PATH_FONT)
  const labelText = labels[0] ?? ""
  const compactLabelText = getCompactLabelText(labels.length)
  const candidates = useMemo(
    () =>
      buildTaskPathCandidates({
        taskTitle,
        subtaskTitle,
        subtaskIndicator,
        hasBlockIndicator: false,
        labelText,
        compactLabelText,
        textFont: rootMeasurement.font,
        focalTaskId: "demo-subtask",
        taskTitleId: "demo-task",
        subtaskTitleId: subtaskTitle.length > 0 ? "demo-subtask" : null,
      }),
    [
      compactLabelText,
      labelText,
      rootMeasurement.font,
      subtaskIndicator,
      subtaskTitle,
      taskTitle,
    ]
  )
  const layout = useMemo(
    () => selectTaskPathLayout(candidates, rootMeasurement.width),
    [candidates, rootMeasurement.width]
  )

  const flow = labelText.length % 2 === 0

  return (
    <div
      ref={rootRef}
      className="flex min-w-0 flex-1 items-center overflow-hidden"
    >
      <div className="flex min-w-0 shrink-0 items-center gap-1">
        <span className="shrink-0 whitespace-nowrap" title={taskTitle}>
          {layout.taskText}
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        <span
          className="shrink-0 whitespace-nowrap text-muted-foreground"
          title={subtaskTitle}
        >
          {layout.subtaskText}
        </span>
        <Badge
          variant="outline"
          className={cn("shrink-0 text-sm", {
            "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300":
              !flow,
          })}
        >
          {flow ? (
            <LoaderCircleIcon data-icon="inline-start" />
          ) : (
            <CassetteTapeIcon data-icon="inline-start" />
          )}
          {subtaskIndicator}
        </Badge>
      </div>
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
    </div>
  )
}
