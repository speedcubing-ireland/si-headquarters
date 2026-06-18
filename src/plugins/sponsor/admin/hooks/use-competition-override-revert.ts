import { useState } from "react"
import { toast } from "sonner"
import type { Id } from "@/convex/_generated/dataModel"
import { useCompetitionSponsorOverride } from "@/plugins/sponsor/hooks/competition-sponsor-property"

export function useCompetitionOverrideRevert() {
  const { setCompetitionSponsorOverride } = useCompetitionSponsorOverride()
  const [busyCompetitionId, setBusyCompetitionId] =
    useState<Id<"competitions"> | null>(null)

  const onRevertCompetitionSponsorOverride = async (
    competitionId: Id<"competitions">
  ) => {
    const shouldRevert = window.confirm(
      "Revert manual sponsor override and return to auction-derived sponsor status?"
    )
    if (!shouldRevert) return
    setBusyCompetitionId(competitionId)
    try {
      await setCompetitionSponsorOverride(competitionId, null)
      toast.success("Sponsor override reverted.")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to revert sponsor override."
      toast.error(message)
    } finally {
      setBusyCompetitionId(null)
    }
  }

  return { busyCompetitionId, onRevertCompetitionSponsorOverride }
}
