import { Button } from "@/components/ui/button"
import {
  PlusIcon,
  CassetteTapeIcon,
  SquareDashedKanbanIcon,
} from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation } from "convex/react"

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
    </div>
  )
}
