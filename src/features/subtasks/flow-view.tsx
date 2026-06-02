import * as TaskDateSelector from "@/components/data-selectors/task-date-selector"
import * as TaskLabelSelector from "@/components/data-selectors/task-label-selector"
import * as TaskOwnerSelector from "@/components/data-selectors/task-owner-selector"
import * as TaskStatusSelector from "@/components/data-selectors/task-status-selector"
import * as UserSelector from "@/components/data-selectors/user-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemFooter,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { TaskFlowView } from "@/convex/tasks/flowView"
import { cn } from "@/lib/utils"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowRightIcon,
  CassetteTapeIcon,
  CornerRightDownIcon,
  PencilIcon,
  Undo2Icon,
} from "lucide-react"
import { memo } from "react"
import "./flow-view.css"
import { TaskInlineIndicators } from "./task-inline-indicators"

const itemAppearance = {
  past: {
    railClassName: "bg-foreground",
    markerClassName: "bg-foreground",
  },
  current: {
    railClassName: "bg-muted",
    markerClassName: "border-2 border-foreground",
  },
  future: {
    railClassName: "bg-muted",
    markerClassName: "border-2 border-muted bg-card",
  },
}

type FlowParent = TaskFlowView["parent"]
type FlowStep = TaskFlowView["steps"][number]

function getLabelIds(labels: FlowStep["labels"]) {
  return labels.map((label) => label._id)
}

const FlowItem = memo(function FlowItem({
  index,
  parent,
  step,
}: {
  index: number
  parent: FlowParent
  step: FlowStep
}) {
  const setAssignees = useMutation(api.tasks.mutations.setTaskAssignees)
  const setDueDate = useMutation(api.tasks.mutations.setTaskDueDate)
  const setLabels = useMutation(api.tasks.mutations.setTaskLabels)
  const setOwner = useMutation(api.tasks.mutations.setTaskOwner)
  const setStatus = useMutation(api.tasks.mutations.setTaskStatus)
  const reopenTask = useMutation(api.tasks.mutations.reopenTask)

  const itemStatus = step.statusView.effectiveStatus
  const completed = itemStatus === "done" || itemStatus === "cancelled"
  const current = parent.currentStepIndex === index
  const past =
    completed &&
    (parent.currentStepIndex === null || parent.currentStepIndex > index)
  const tone = itemAppearance[current ? "current" : past ? "past" : "future"]
  const itemVariant = completed ? "muted" : "outline"
  const taskId = step.task._id

  return (
    <div className="group/flow-step grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2">
      <div aria-hidden="true" className="flex flex-col items-center">
        <div className="relative size-5 shrink-0 rounded-full bg-card">
          {current && (
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
        {completed && (
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
                    #{index + 1}
                  </span>{" "}
                  {step.task.name}
                </h3>
                <TaskInlineIndicators
                  blockers={step.blockers}
                  kind={step.task.kind}
                  progress={step.statusView.progress}
                  subtaskSummary={step.subtaskSummary}
                />
              </ItemTitle>
            </ItemContent>
            <ItemActions>
              <TaskStatusSelector.CompactButton
                className="hidden @sm/main:flex"
                statusView={step.statusView}
                onChange={(status) => {
                  void setStatus({ id: taskId, status })
                }}
              />
              {step.statusView.availableActions.includes("reopen") && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    void reopenTask({ id: taskId })
                  }}
                >
                  <Undo2Icon />
                  Reopen
                </Button>
              )}
            </ItemActions>
          </ItemHeader>

          <ItemFooter>
            <ItemActions>
              <TaskLabelSelector.CompactButton
                selectedLabels={step.labels}
                value={getLabelIds(step.labels)}
                onChange={(labelIds) => {
                  void setLabels({ id: taskId, labelIds })
                }}
              />
              <TaskDateSelector.CompactButton
                value={step.task.dueDate}
                onChange={(dueDate) => {
                  void setDueDate({ id: taskId, dueDate })
                }}
              />
            </ItemActions>
            <ItemActions>
              <TaskOwnerSelector.NameButton
                selectedOwner={step.owner}
                onChange={(owner) => {
                  void setOwner({ id: taskId, owner })
                }}
              />
              <ArrowRightIcon className="hidden size-3.5 shrink-0 text-muted-foreground/70 @sm/main:block" />
              <CornerRightDownIcon className="size-3.5 shrink-0 text-muted-foreground/70 @sm/main:hidden" />
              <span className="hidden @sm/main:inline-flex">
                <UserSelector.MultiCompactButton
                  selectedUsers={step.assignees.users}
                  value={step.assignees.userIds}
                  onChange={(assigneeIds) => {
                    void setAssignees({ id: taskId, assigneeIds })
                  }}
                />
              </span>
            </ItemActions>
          </ItemFooter>
          <ItemFooter className="border-t pt-2 @sm/main:hidden">
            <ItemActions>
              <TaskStatusSelector.CompactButton
                statusView={step.statusView}
                onChange={(status) => {
                  void setStatus({ id: taskId, status })
                }}
              />
            </ItemActions>
            <ItemActions>
              <UserSelector.MultiCompactButton
                selectedUsers={step.assignees.users}
                value={step.assignees.userIds}
                onChange={(assigneeIds) => {
                  void setAssignees({ id: taskId, assigneeIds })
                }}
              />
            </ItemActions>
          </ItemFooter>
        </Item>
      </div>
    </div>
  )
})

export function FlowView({ taskId }: { taskId: Id<"tasks"> }) {
  const flow = useQuery(api.tasks.queries.getFlowView, { id: taskId })
  const setTaskKind = useMutation(api.tasks.mutations.setTaskKind)

  if (flow === undefined) {
    return null
  }

  return (
    <div className="col-span-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="lg">
          <PencilIcon />
          Edit Tasks
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            void setTaskKind({ id: taskId, kind: "standard" })
          }}
        >
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
          <div className="flex w-full flex-col">
            {flow.steps.map((step, index) => (
              <FlowItem
                key={step.task._id}
                index={index}
                parent={flow.parent}
                step={step}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
