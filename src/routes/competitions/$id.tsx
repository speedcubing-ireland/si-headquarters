import { CompetitionPage } from "@/features/competitions/competition-page"
import { requireCompetitionId } from "@/lib/convex-ids"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/competitions/$id")({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const competitionId = requireCompetitionId(id)

  return <CompetitionPage competitionId={competitionId} />
}
