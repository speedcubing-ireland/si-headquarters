import { Button } from "@/components/ui/button"
import { useMeasuredElement } from "@/hooks/use-measured-element"
import { ChevronRightIcon, CircleDotIcon, LoaderCircleIcon } from "lucide-react"
import { useMemo } from "react"
import { Avatar, AvatarImage } from "../ui/avatar"
import { Badge } from "../ui/badge"
import { Card, CardContent } from "../ui/card"
import {
  buildTaskPathCandidates,
  DEFAULT_TASK_PATH_FONT,
  getCompactLabelText,
  selectTaskPathLayout,
} from "./task-path-layout"

type InlineDataRow = {
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
    id: "HQ-133",
    assigneeAvatarUrl: "https://github.com/simonkellly.png",
    taskTitle: "Design Certificate Background",
    subtaskTitle: "Design Certs",
    subtaskIndicator: "1/3",
    labels: ["Certificates"],
    dueDate: "Aug 18",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=C T",
  },
  {
    id: "HQ-134",
    assigneeAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=A R",
    taskTitle: "Publish Registration Pack",
    subtaskTitle: "Review Long-Form Eligibility Copy",
    subtaskIndicator: "2/5",
    labels: ["Operations"],
    dueDate: "Aug 22",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=O P",
  },
  {
    id: "HQ-135",
    assigneeAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=M K",
    taskTitle: "Confirm Venue Floorplan",
    subtaskTitle: "Fire Exit Signage",
    subtaskIndicator: "4/4",
    labels: ["Venue"],
    dueDate: "Sep 02",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=V N",
  },
]

export default function InlineDataView() {
  return (
    <Card className="col-span-full flex h-96 flex-col">
      <CardContent className="my-2 border-y py-0">
        {demoRows.map((row) => (
          <InlineDataViewRow key={row.id} row={row} />
        ))}
      </CardContent>
    </Card>
  )
}

function InlineDataViewRow({ row }: { row: InlineDataRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b py-2 last:border-b-0">
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
        <p className="font-mono">{row.dueDate}</p>
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
  const [rootRef, rootMeasurement] = useMeasuredElement<HTMLDivElement>(
    DEFAULT_TASK_PATH_FONT
  )
  const labelText = labels[0] ?? ""
  const compactLabelText = getCompactLabelText(labels.length)
  const candidates = useMemo(
    () =>
      buildTaskPathCandidates({
        taskTitle,
        subtaskTitle,
        subtaskIndicator,
        labelText,
        compactLabelText,
        textFont: rootMeasurement.font,
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
        <Badge variant="outline" className="shrink-0 text-sm">
          <LoaderCircleIcon data-icon="inline-start" />
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
