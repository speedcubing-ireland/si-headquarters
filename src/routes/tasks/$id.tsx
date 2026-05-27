import { Task } from "@/features/tasks/task-page"
import { requireTaskId } from "@/lib/convex-ids"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/tasks/$id")({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const taskId = requireTaskId(id)

  return <Task taskId={taskId} />
}
