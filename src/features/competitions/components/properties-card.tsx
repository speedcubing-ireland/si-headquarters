import * as PhaseSelector from "@/components/data-selectors/phase-selector"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { InfoIcon, MilestoneIcon } from "lucide-react"
import { CompetitionLinkedResourcesFooter } from "@/features/competition-resources/footer"
import {
  PageCard,
  PageCardContent,
  PageCardFooter,
  PageCardRow,
} from "@/components/page-card"
import { PLUGINS } from "@/plugins/registry"
import { isSponsorshipEnabled } from "@/lib/feature-flags"

export function PropertiesCard({
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
        <PageCardRow icon={<MilestoneIcon className="size-4" />} label="Phase">
          <PhaseSelector.PropertyButton
            owner={{
              type: "competitions",
              id: comp._id,
            }}
            selectedPhase={phase}
            value={comp.phaseId}
            onChange={(phaseId) => {
              void setCompPhase({
                id: comp._id,
                phaseId,
              })
            }}
          />
        </PageCardRow>
        {isSponsorshipEnabled
          ? PLUGINS.flatMap((plugin) => plugin.competitionProperties).map(
              (PropertyRow) => (
                <PropertyRow
                  key={PropertyRow.name}
                  competitionId={competitionId}
                />
              )
            )
          : null}
      </PageCardContent>
      <PageCardFooter className="flex flex-col items-start gap-2">
        <CompetitionLinkedResourcesFooter competitionId={competitionId} />
      </PageCardFooter>
    </PageCard>
  )
}
