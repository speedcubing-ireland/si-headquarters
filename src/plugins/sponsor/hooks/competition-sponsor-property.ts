import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { parseCompetitionId } from "@/lib/convex-ids"
import type { CompetitionSponsorPropertyStatus } from "@/convex/plugins/sponsor/lib/competitionSponsorStatus"

export interface CompetitionSponsorOverride {
  status: CompetitionSponsorPropertyStatus
  manualSponsorId: Id<"sponsors"> | null
}

export function useCompetitionSponsorProperty(
  competitionId: Id<"competitions"> | null
) {
  const property = useQuery(
    api.plugins.sponsor.admin.propertyStatus.getForCompetition,
    competitionId !== null ? { competitionId } : "skip"
  )
  return {
    property: property ?? null,
    isLoading: competitionId !== null && property === undefined,
  }
}

export function useCompetitionSponsorPropertyRow(competitionId: string) {
  const competitionConvexId = parseCompetitionId(competitionId)
  const { property, isLoading } =
    useCompetitionSponsorProperty(competitionConvexId)

  return {
    competitionConvexId,
    property,
    isLoading: competitionConvexId !== null && isLoading,
  }
}

export function useCompetitionSponsorOverride() {
  const setManualOverride = useMutation(
    api.plugins.sponsor.admin.propertyStatus.setManualOverride
  )

  return {
    setCompetitionSponsorOverride: async (
      competitionId: Id<"competitions">,
      override: CompetitionSponsorOverride | null
    ) => {
      if (override === null) {
        await setManualOverride({
          competitionId,
          status: null,
          manualSponsorId: null,
        })
        return
      }
      await setManualOverride({
        competitionId,
        status: override.status,
        manualSponsorId: override.manualSponsorId,
      })
    },
  }
}
