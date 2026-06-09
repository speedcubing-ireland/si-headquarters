import { ProjectsPage } from "@/features/projects/list/projects-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/projects/")({
  component: ProjectsRoute,
})

function ProjectsRoute() {
  return <ProjectsPage />
}
