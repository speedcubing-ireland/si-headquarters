import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { TaskFlowView } from "@/convex/tasks/flowView"
import { useMutation } from "convex/react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  PencilIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type FlowStep = TaskFlowView["steps"][number]

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return items

  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function FlowOrderRow({
  index,
  step,
  total,
  onMoveUp,
  onMoveDown,
}: {
  index: number
  step: FlowStep
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
        #{index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">
        {step.task.name}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Move ${step.task.name} up`}
          disabled={index === 0}
          onClick={onMoveUp}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Move ${step.task.name} down`}
          disabled={index === total - 1}
          onClick={onMoveDown}
        >
          <ArrowDownIcon />
        </Button>
      </div>
    </div>
  )
}

export function FlowOrderEditButton({
  stepCount,
  onStart,
}: {
  stepCount: number
  onStart: () => void
}) {
  return (
    <Button
      variant="outline"
      size="lg"
      type="button"
      onClick={() => {
        if (stepCount < 2) {
          toast.message("Add at least two flow steps before reordering.")
          return
        }
        onStart()
      }}
    >
      <PencilIcon />
      Edit order
    </Button>
  )
}

export function FlowOrderPanel({
  flowTaskId,
  steps,
  onCancel,
  onSaved,
}: {
  flowTaskId: Id<"tasks">
  steps: FlowStep[]
  onCancel: () => void
  onSaved: () => void
}) {
  const reorderChildTasks = useMutation(api.tasks.mutations.reorderChildTasks)
  const savedOrder = useMemo(
    () => steps.map((step) => step.task._id),
    [steps]
  )
  const [draftOrder, setDraftOrder] = useState(savedOrder)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setDraftOrder(savedOrder)
  }, [savedOrder])

  const hasChanges = useMemo(() => {
    if (draftOrder.length !== savedOrder.length) return false
    return draftOrder.some((taskId, index) => taskId !== savedOrder[index])
  }, [draftOrder, savedOrder])

  const orderedSteps = draftOrder
    .map((taskId) => steps.find((step) => step.task._id === taskId))
    .filter((step): step is FlowStep => step !== undefined)

  const saveOrder = async () => {
    if (!hasChanges) {
      onSaved()
      return
    }

    setIsSaving(true)
    try {
      await reorderChildTasks({
        parent: { type: "tasks", id: flowTaskId },
        orderedTaskIds: draftOrder,
      })
      toast.success("Flow order saved")
      onSaved()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save flow order."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="col-span-full flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="lg"
          type="button"
          disabled={isSaving}
          onClick={onCancel}
        >
          <XIcon />
          Cancel
        </Button>
        <Button
          variant="default"
          size="lg"
          type="button"
          disabled={isSaving || !hasChanges}
          onClick={() => {
            void saveOrder()
          }}
        >
          <CheckIcon />
          {isSaving ? "Saving..." : "Save order"}
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {orderedSteps.map((step, index) => (
          <FlowOrderRow
            key={step.task._id}
            index={index}
            step={step}
            total={orderedSteps.length}
            onMoveUp={() => {
              setDraftOrder((current) => moveItem(current, index, -1))
            }}
            onMoveDown={() => {
              setDraftOrder((current) => moveItem(current, index, 1))
            }}
          />
        ))}
      </div>
    </div>
  )
}
