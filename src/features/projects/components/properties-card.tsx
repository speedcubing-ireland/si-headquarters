import { PhasePropertyRow } from "@/features/shared/phase-property-row"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TABS,
} from "@/features/projects/project-status"
import { isProjectStatus } from "@/convex/projects/statuses"
import type { ProjectStatus } from "@/convex/projects/statuses"
import { useMutation, useQuery } from "convex/react"
import { CircleDotIcon, InfoIcon } from "lucide-react"
import {
  PageCard,
  PageCardContent,
  PageCardFooter,
  PageCardRow,
} from "@/components/page-card"
import { ObjectLinkedResourcesFooter } from "@/features/integrations/object-linked-resources-footer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ProjectPropertiesCard({
  canUpdate,
  projectId,
}: {
  canUpdate: boolean
  projectId: Id<"projects">
}) {
  const properties = useQuery(api.projects.queries.getProperties, {
    id: projectId,
  })
  const setCurrentPhase = useMutation(api.projects.mutations.setCurrentPhase)
  const setStatus = useMutation(api.projects.mutations.setStatus)

  if (properties === undefined) {
    return null
  }

  const { project, phase } = properties
  const statusOptions = PROJECT_STATUS_TABS.filter(
    (tab): tab is ProjectStatus => tab !== "all"
  )

  return (
    <PageCard title="Properties" icon={<InfoIcon className="size-4" />}>
      <PageCardContent>
        <PageCardRow icon={<CircleDotIcon className="size-4" />} label="Status">
          <Select
            value={project.status}
            disabled={!canUpdate}
            onValueChange={(value: string) => {
              if (!isProjectStatus(value)) return
              void setStatus({
                id: projectId,
                status: value,
              })
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {PROJECT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PageCardRow>
        <PhasePropertyRow
          owner={{ type: "projects", id: project._id }}
          phaseId={project.phaseId}
          selectedPhase={phase}
          disabled={!canUpdate}
          onChange={(phaseId) => {
            void setCurrentPhase({
              id: projectId,
              phaseId,
            })
          }}
        />
      </PageCardContent>
      <PageCardFooter className="flex flex-col items-start gap-2">
        <ObjectLinkedResourcesFooter
          object={{ type: "projects", id: projectId }}
        />
      </PageCardFooter>
    </PageCard>
  )
}
