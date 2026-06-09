import { TeamProjectsPage } from "@/features/projects/list/projects-page"
import { requireTeamId } from "@/lib/convex-ids"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/teams/$teamId/projects/")({
  component: TeamProjectsRoute,
})

function TeamProjectsRoute() {
  const { teamId: teamIdParam } = Route.useParams()
  return <TeamProjectsPage teamId={requireTeamId(teamIdParam)} />
}
