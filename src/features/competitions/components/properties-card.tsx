import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { PhasePropertyRow } from "@/features/shared/phase-property-row"
import { useMutation, useQuery } from "convex/react"
import { InfoIcon } from "lucide-react"
import { ObjectLinkedResourcesFooter } from "@/features/integrations/object-linked-resources-footer"
import {
  PageCard,
  PageCardContent,
  PageCardFooter,
} from "@/components/page-card"
import { PLUGINS } from "@/plugins/registry"

export function CompetitionPropertiesCard({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const properties = useQuery(api.competitions.queries.getProperties, {
    id: competitionId,
  })
  const setCompPhase = useMutation(api.competitions.mutations.setCompPhase)

  if (properties === undefined) {
    return null
  }

  const { competition: comp, phase } = properties

  // To-do: Most of this is still placeholder
  return (
    <PageCard title="Properties" icon={<InfoIcon className="size-4" />}>
      <PageCardContent>
        <PhasePropertyRow
          owner={{ type: "competitions", id: comp._id }}
          phaseId={comp.phaseId}
          selectedPhase={phase}
          onChange={(phaseId) => {
            void setCompPhase({
              id: comp._id,
              phaseId,
            })
          }}
        />
        {PLUGINS.flatMap((plugin) => plugin.competitionProperties).map(
          (PropertyRow) => (
            <PropertyRow key={PropertyRow.name} competitionId={competitionId} />
          )
        )}
      </PageCardContent>
      <PageCardFooter className="flex flex-col items-start gap-2">
        <ObjectLinkedResourcesFooter
          object={{ type: "competitions", id: competitionId }}
        />
      </PageCardFooter>
    </PageCard>
  )
}
