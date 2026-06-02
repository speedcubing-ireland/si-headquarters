import { TaskListPage } from "@/features/tasks/list/task-list-page"
import { requireTeamId } from "@/lib/convex-ids"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/teams/$teamId/tasks/")({
  component: TeamTasksRoute,
})

function TeamTasksRoute() {
  const { teamId: teamIdParam } = Route.useParams()
  return <TaskListPage teamId={requireTeamId(teamIdParam)} />
}
