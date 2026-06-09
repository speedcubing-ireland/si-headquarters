import { ProjectPage } from "@/features/projects/project-page"
import { requireProjectId } from "@/lib/convex-ids"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/projects/$id")({
  component: ProjectDetailRoute,
})

function ProjectDetailRoute() {
  const { id: projectIdParam } = Route.useParams()
  return <ProjectPage projectId={requireProjectId(projectIdParam)} />
}
