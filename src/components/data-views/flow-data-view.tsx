import {
  ArrowRightIcon,
  CalendarIcon,
  CassetteTapeIcon,
  CircleCheck,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  CornerRightDownIcon,
  EyeIcon,
  PencilIcon,
  Undo2Icon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

import { cn } from "@/lib/utils"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "../ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemFooter,
  ItemHeader,
  ItemTitle,
} from "../ui/item"
import "./flow.css"

const flowTone = {
  completed: {
    railClassName: "bg-foreground",
    markerClassName: "bg-foreground",
    current: false,
  },
  current: {
    railClassName: "bg-muted",
    markerClassName: "border-2 border-foreground",
    current: true,
  },
  unfinished: {
    railClassName: "bg-muted",
    markerClassName: "border-2 border-muted bg-card",
    current: false,
  },
}

const flowStatus = {
  completed: {
    label: "Complete",
    icon: CircleCheck,
    tone: "completed",
  },
  todo: {
    label: "To-do",
    icon: CircleIcon,
    tone: "unfinished",
  },
  in_progress: {
    label: "In progress",
    icon: CircleDotIcon,
    tone: "unfinished",
  },
  awaiting_review: {
    label: "Awaiting review",
    icon: EyeIcon,
    tone: "current",
  },
  backlog: {
    label: "Backlog",
    icon: CircleDashedIcon,
    tone: "unfinished",
  },
} satisfies Record<
  string,
  {
    label: string
    icon: LucideIcon
    tone: keyof typeof flowTone
  }
>

type FlowStatus = keyof typeof flowStatus

type FlowStep = {
  id: number
  taskId: string
  title: string
  status: FlowStatus
  label: string
  dueDate?: string
  subtaskProgress?: {
    completed: number
    total: number
  }
  assigneeName: string
  assigneeAvatarUrl: string
  ownerName: string
}

const flowSteps: FlowStep[] = [
  {
    id: 1,
    taskId: "#144",
    title: "Confirm Website Goals",
    status: "completed",
    label: "Strategy",
    dueDate: "Jul 02",
    subtaskProgress: { completed: 2, total: 2 },
    assigneeName: "Iris Rao",
    assigneeAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=IR",
    ownerName: "Software Team",
  },
  {
    id: 2,
    taskId: "#145",
    title: "Draft Page Structure",
    status: "completed",
    label: "Content",
    dueDate: "Jul 08",
    assigneeName: "Casey Owen",
    assigneeAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=CO",
    ownerName: "Competitions Team",
  },
  {
    id: 3,
    taskId: "#146",
    title: "Review Responsive Mockup",
    status: "awaiting_review",
    label: "Design",
    dueDate: "Jul 15",
    subtaskProgress: { completed: 1, total: 3 },
    assigneeName: "Design Studio",
    assigneeAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=DS",
    ownerName: "Graphics Team",
  },
  {
    id: 4,
    taskId: "#147",
    title: "Build Marketing Pages",
    status: "backlog",
    label: "Frontend",
    dueDate: "Jul 22",
    subtaskProgress: { completed: 0, total: 4 },
    assigneeName: "Frontend Engineering",
    assigneeAvatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=FE",
    ownerName: "Social Media Team",
  },
]

function getSubtaskText(step: FlowStep) {
  if (!step.subtaskProgress) {
    return null
  }

  const { completed, total } = step.subtaskProgress

  return `${completed}/${total}`
}

function FlowStepStatusButton({
  step,
  status,
  StatusIcon,
}: {
  step: FlowStep
  status: (typeof flowStatus)[FlowStatus]
  StatusIcon: LucideIcon
}) {
  if (step.status === "completed") {
    return (
      <Button
        variant="outline"
        size="sm"
        aria-label={`Return ${step.taskId} to ${step.label}`}
      >
        <Undo2Icon />
        Reopen
      </Button>
    )
  }

  if (step.status === "backlog") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        aria-label={`${step.taskId} status ${status.label}`}
      >
        <StatusIcon />
        {status.label}
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={`Change ${step.taskId} status from ${status.label}`}
    >
      <StatusIcon />
      {status.label}
    </Button>
  )
}

function FlowStepAssigneeButton({ step }: { step: FlowStep }) {
  return (
    <Button variant="outline" size="sm">
      <Avatar className="size-4" title={`${step.assigneeName}, assignee`}>
        <AvatarImage src={step.assigneeAvatarUrl} />
      </Avatar>
      {step.assigneeName.split(" ")[0]}
    </Button>
  )
}

export function Pattern() {
  return (
    <div className="flex w-full flex-col">
      {flowSteps.map((step) => {
        const status = flowStatus[step.status]
        const tone = flowTone[status.tone]
        const StatusIcon = status.icon
        const subtaskText = getSubtaskText(step)
        const showRail = step.status === "completed"
        const itemVariant = step.status === "completed" ? "muted" : "outline"

        return (
          <div
            key={step.id}
            className="group/flow-step grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2"
          >
            <div aria-hidden="true" className="flex flex-col items-center">
              <div className="relative size-5 shrink-0 rounded-full bg-card">
                {tone.current && (
                  <>
                    <span className="animate-flow-current-fill absolute inset-1 rounded-full bg-foreground" />
                    <span className="animate-flow-current-release absolute inset-0 rounded-full border-2 border-foreground" />
                  </>
                )}
                <span
                  className={cn(
                    "absolute inset-0 z-10 rounded-full",
                    tone.markerClassName
                  )}
                />
              </div>
              {showRail && (
                <div
                  className={cn(
                    "min-h-4 w-0.5 flex-1 group-last/flow-step:hidden",
                    tone.railClassName
                  )}
                />
              )}
            </div>
            <div className="min-w-0 pb-4 text-foreground group-last/flow-step:pb-0">
              <Item variant={itemVariant}>
                <ItemHeader>
                  <ItemContent>
                    <ItemTitle>
                      <h3>
                        <span className="font-mono text-muted-foreground">
                          {step.taskId}
                        </span>{" "}
                        {step.title}
                      </h3>
                      {subtaskText && (
                        <Badge
                          variant="outline"
                          className="hidden text-sm sm:flex"
                        >
                          <CassetteTapeIcon data-icon="inline-start" />
                          {subtaskText}
                        </Badge>
                      )}
                    </ItemTitle>
                  </ItemContent>
                  <ItemActions className="hidden sm:flex">
                    <FlowStepStatusButton
                      step={step}
                      status={status}
                      StatusIcon={StatusIcon}
                    />
                  </ItemActions>
                </ItemHeader>

                <ItemFooter>
                  <ItemActions>
                    <Button variant="outline" size="sm">
                      <Badge
                        className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                        title={step.label}
                      >
                        {step.label}
                      </Badge>
                    </Button>
                    {step.dueDate && (
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`${step.taskId} due date ${step.dueDate}`}
                      >
                        <CalendarIcon className="hidden sm:inline-flex" />
                        {step.dueDate}
                      </Button>
                    )}
                  </ItemActions>
                  <ItemActions>
                    <Button variant="outline" size="sm">
                      {step.ownerName.replace(" Team", "")}
                    </Button>
                    <ArrowRightIcon className="hidden size-3.5 shrink-0 text-muted-foreground/70 sm:block" />
                    <CornerRightDownIcon className="size-3.5 shrink-0 text-muted-foreground/70 sm:hidden" />
                    <span className="hidden sm:inline-flex">
                      <FlowStepAssigneeButton step={step} />
                    </span>
                  </ItemActions>
                </ItemFooter>

                <ItemFooter className="border-t pt-2 sm:hidden">
                  <ItemActions>
                    <FlowStepStatusButton
                      step={step}
                      status={status}
                      StatusIcon={StatusIcon}
                    />
                  </ItemActions>
                  <ItemActions>
                    <FlowStepAssigneeButton step={step} />
                  </ItemActions>
                </ItemFooter>
              </Item>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function FlowDataView({
  toggleFlow,
}: {
  toggleFlow: () => void
}) {
  return (
    <div className="col-span-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="lg">
          <PencilIcon />
          Edit Tasks
        </Button>
        <Button variant="outline" size="lg" onClick={toggleFlow}>
          <Undo2Icon />
          To Subtasks
        </Button>
      </div>
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            Task Flow
            <CassetteTapeIcon className="size-4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Pattern />
        </CardContent>
      </Card>
    </div>
  )
}
