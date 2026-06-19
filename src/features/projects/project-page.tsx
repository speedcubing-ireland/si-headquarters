import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { ProjectDetailsCard } from "@/features/projects/components/details-card"
import { ProjectPeopleCard } from "@/features/projects/components/people-card"
import { EditPhasesButton } from "@/features/phases/edit-phases-dialog"
import { ProjectPropertiesCard } from "@/features/projects/components/properties-card"
import { ProjectWorkflowsCard } from "@/features/projects/components/workflows-card"
import { SubtaskView } from "@/features/subtasks/subtask-view"
import { CurrentUpdateCard } from "@/features/updates/current-update-card"
import { CommentsCardContainer } from "@/features/comments/comments-card-container"
import { ObjectPageGrid } from "@/features/shared/object-page-grid"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"

export function ProjectPage({ projectId }: { projectId: Id<"projects"> }) {
  const project = useQuery(api.projects.queries.getPageRoot, { id: projectId })

  return (
    <Page.Shell
      title={project?.name ?? "Project"}
      contentClassName={PAGE_CONTENT_PADDING_SCROLL}
    >
      <Page.EntityState
        value={project}
        loadingMessage="Loading project…"
        emptyMessage="Project not found."
      >
        {(project) => (
          <ObjectPageGrid>
            <ProjectDetailsCard project={project} projectId={projectId} />
            <ProjectPropertiesCard
              canUpdate={project.canUpdate}
              projectId={projectId}
            />
            <ProjectPeopleCard
              canUpdate={project.canUpdate}
              projectId={projectId}
            />
            <ProjectWorkflowsCard
              canUpdate={project.canUpdate}
              projectId={projectId}
            />
            <CurrentUpdateCard
              object={{ type: "projects", id: projectId }}
              title="Project update"
            />
            <SubtaskView
              owner={{ type: "projects", id: projectId }}
              toolbarActions={
                <EditPhasesButton owner={{ type: "projects", id: projectId }} />
              }
            />
            <CommentsCardContainer
              target={{ type: "projects", id: projectId }}
            />
          </ObjectPageGrid>
        )}
      </Page.EntityState>
    </Page.Shell>
  )
}
