import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { HandIcon, Undo2Icon, VibrateIcon } from "lucide-react"
import { toast } from "sonner"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { isClaimableAssigneeIds } from "@/convex/tasks/assignees"

type NudgeEligibility = FunctionReturnType<
  typeof api.notifications.nudge.getEligibility
>

function nudgeDisabledMessage(
  eligibility: NudgeEligibility | undefined
): string | null {
  if (eligibility === undefined || eligibility.canNudge) return null

  switch (eligibility.reason) {
    case "claimed":
      return "You claimed this task, so there is nobody else to nudge."
    case "cooldown":
      return "This assignee was nudged recently. Try again in 24 hours."
    case "complete":
      return "This task is already complete."
    case "missing_task":
    case "no_assignees":
      return null
  }
}

export default function DynamicActionButton({ task }: { task: Doc<"tasks"> }) {
  const claimTask = useMutation(api.tasks.mutations.claimTask)
  const reopenTask = useMutation(api.tasks.mutations.reopenTask)
  const nudgeTask = useMutation(api.notifications.nudge.nudgeTask)
  const canReopen = task.kind === "flow" && isTerminalComplete(task.status)
  const canShowNudge =
    !canReopen && Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0
  const nudgeEligibility = useQuery(
    api.notifications.nudge.getEligibility,
    canShowNudge ? { taskId: task._id } : "skip"
  )

  if (canReopen) {
    return (
      <Button
        size="lg"
        onClick={() => {
          void reopenTask({ id: task._id })
        }}
      >
        <Undo2Icon />
        Reopen
      </Button>
    )
  }

  if (isClaimableAssigneeIds(task.assigneeIds)) {
    return (
      <Button
        size="lg"
        onClick={() => {
          void claimTask({ id: task._id })
        }}
      >
        <HandIcon />
        Claim
      </Button>
    )
  }

  const canNudge = nudgeEligibility?.canNudge === true
  const disabledMessage = nudgeDisabledMessage(nudgeEligibility)

  const nudgeButton = (
    <Button
      size="lg"
      disabled={!canNudge}
      onClick={() => {
        void (async () => {
          try {
            await nudgeTask({ taskId: task._id })
            toast.success("Nudge sent.")
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not send nudge."
            )
          }
        })()
      }}
    >
      <VibrateIcon />
      Nudge
    </Button>
  )

  if (disabledMessage === null) {
    return nudgeButton
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{nudgeButton}</span>
      </TooltipTrigger>
      <TooltipContent>{disabledMessage}</TooltipContent>
    </Tooltip>
  )
}
