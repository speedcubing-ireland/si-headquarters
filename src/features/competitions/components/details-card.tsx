import * as DateRangeSelector from "@/features/competitions/components/date-range-selector"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { PhaseProgressTrackerForOwner } from "@/features/phases/phase-progress-tracker"
import { ObjectDetailsCard } from "@/features/shared/object-details-card"
import { useMutation } from "convex/react"

export function CompetitionDetailsCard({
  comp,
  competitionId,
}: {
  comp: Doc<"competitions">
  competitionId: Id<"competitions">
}) {
  const setCompDates = useMutation(api.competitions.mutations.setCompDates)
  const updateDetails = useMutation(api.competitions.mutations.setCompDetails)

  return (
    <ObjectDetailsCard
      name={comp.name}
      description={comp.description}
      metadata={
        <DateRangeSelector.Button
          value={{
            from: comp.compDates.from ?? null,
            to: comp.compDates.to ?? null,
          }}
          onChange={({ from, to }) => {
            void setCompDates({ id: competitionId, from, to })
          }}
        />
      }
      phaseProgress={
        <PhaseProgressTrackerForOwner
          owner={{ type: "competitions", id: competitionId }}
        />
      }
      editDialog={{
        descriptionId: "competition-description",
        descriptionPlaceholder: "Add the competition description...",
        initialValue: comp,
        nameId: "competition-name",
        title: "Edit competition details",
        triggerLabel: "Edit competition details",
        onSubmit: (value) => {
          void updateDetails({ id: competitionId, ...value })
        },
      }}
      watchObject={{ type: "competitions", id: competitionId }}
    />
  )
}
