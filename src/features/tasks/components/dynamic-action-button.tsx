import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { HandIcon, Undo2Icon, VibrateIcon } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { isTerminalComplete } from "@/convex/tasks/status/rules";

export default function DynamicActionButton({ task }: {
  task: Doc<"tasks">,
}) {
  const claimTask = useMutation(api.tasks.mutations.claimTask);
  const reopenTask = useMutation(api.tasks.mutations.reopenTask);

  const canReopen = task.kind === "flow" && isTerminalComplete(task.status);

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


  if (task.assigneeIds === "assignable" || task.assigneeIds === null || task.assigneeIds.length === 0) {
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
    );
  }

  return (
     <Button
      size="lg"
      onClick={() => {
        void claimTask({ id: task._id })
      }}
      noop
    >
      <VibrateIcon />
      Nudge
    </Button>
  )
  
}
