import { Badge } from "@/components/ui/badge"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import { PhaseProgressTrackerForOwner } from "@/features/phases/phase-progress-tracker"
import { ProjectWorkflowButton } from "@/features/projects/components/workflows-card"
import { PROJECT_STATUS_LABELS } from "@/features/projects/project-status"
import { ObjectDetailsCard } from "@/features/shared/object-details-card"
import { useMutation } from "convex/react"

export function ProjectDetailsCard({
  project,
  projectId,
}: {
  project: NonNullable<
    FunctionReturnType<typeof api.projects.queries.getPageRoot>
  >
  projectId: Id<"projects">
}) {
  const updateDetails = useMutation(api.projects.mutations.setDetails)

  return (
    <ObjectDetailsCard
      name={project.name}
      description={project.description}
      metadata={
        <Badge variant="outline">{PROJECT_STATUS_LABELS[project.status]}</Badge>
      }
      phaseProgress={
        <PhaseProgressTrackerForOwner
          owner={{ type: "projects", id: projectId }}
        />
      }
      editDialog={
        project.canUpdate
          ? {
              descriptionId: "project-description",
              descriptionPlaceholder: "Add the project description...",
              initialValue: project,
              nameId: "project-name",
              title: "Edit project details",
              triggerLabel: "Edit project details",
              onSubmit: (value) => {
                void updateDetails({ id: projectId, ...value })
              },
            }
          : undefined
      }
      watchObject={{ type: "projects", id: projectId }}
      footer={
        project.canUpdate ? (
          <ProjectWorkflowButton projectId={projectId} />
        ) : null
      }
    />
  )
}
