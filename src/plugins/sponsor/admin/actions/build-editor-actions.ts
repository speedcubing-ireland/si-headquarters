import type { SetStateAction, Dispatch } from "react"
import { toast } from "sonner"
import type { Id } from "@/convex/_generated/dataModel"
import type { SponsorshipAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import { toDatetimeLocalInput } from "@/plugins/sponsor/lib/sponsorship-ui"

export interface EditorActionsDeps {
  activeSponsors: { id: Id<"sponsors"> }[]
  setCompetitionSponsorOverride: (
    competitionId: Id<"competitions">,
    override: null
  ) => Promise<void>
  setEditorMode: Dispatch<SetStateAction<"create" | "edit">>
  setSelectedAuctionId: Dispatch<
    SetStateAction<Id<"sponsorshipAuctions"> | null>
  >
  setCreateFramework: Dispatch<SetStateAction<SponsorshipAuctionFramework>>
  setIsCreateFrameworkUnlocked: Dispatch<SetStateAction<boolean>>
  setCreateStartsAtInput: Dispatch<SetStateAction<string>>
  setCreateEndsAtInput: Dispatch<SetStateAction<string>>
  setCreateStartPriceEuros: Dispatch<SetStateAction<string>>
  setCreateInvitedSponsorIds: (
    updater: SetStateAction<Id<"sponsors">[]>
  ) => void
  setCreateCompetitionIdSelection: Dispatch<
    SetStateAction<Id<"competitions"> | null>
  >
  setIsEditFrameworkUnlocked: Dispatch<SetStateAction<boolean>>
  setEditInvitedSponsorIds: Dispatch<SetStateAction<Id<"sponsors">[]>>
  setBusyCompetitionId: Dispatch<SetStateAction<Id<"competitions"> | null>>
}

export function buildEditorActions(deps: EditorActionsDeps) {
  const {
    activeSponsors,
    setCompetitionSponsorOverride,
    setEditorMode,
    setSelectedAuctionId,
    setCreateFramework,
    setIsCreateFrameworkUnlocked,
    setCreateStartsAtInput,
    setCreateEndsAtInput,
    setCreateStartPriceEuros,
    setCreateInvitedSponsorIds,
    setCreateCompetitionIdSelection,
    setIsEditFrameworkUnlocked,
    setEditInvitedSponsorIds,
    setBusyCompetitionId,
  } = deps

  const resetCreatePanel = () => {
    setEditorMode("create")
    setSelectedAuctionId(null)
    setCreateFramework("first_sealed")
    setIsCreateFrameworkUnlocked(false)
    setCreateStartsAtInput(
      toDatetimeLocalInput(new Date(Date.now() + 60 * 60 * 1000))
    )
    setCreateEndsAtInput(
      toDatetimeLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000))
    )
    setCreateStartPriceEuros("100")
    setCreateInvitedSponsorIds(activeSponsors.map((sponsor) => sponsor.id))
    setCreateCompetitionIdSelection(null)
  }

  const selectAuctionForEditing = (auctionId: Id<"sponsorshipAuctions">) => {
    setSelectedAuctionId(auctionId)
    setEditorMode("edit")
    setIsEditFrameworkUnlocked(false)
  }

  const toggleCreateSponsorInvite = (sponsorId: Id<"sponsors">) => {
    setCreateInvitedSponsorIds((current) =>
      current.includes(sponsorId)
        ? current.filter((id) => id !== sponsorId)
        : [...current, sponsorId]
    )
  }

  const toggleEditSponsorInvite = (sponsorId: Id<"sponsors">) => {
    setEditInvitedSponsorIds((current) =>
      current.includes(sponsorId)
        ? current.filter((id) => id !== sponsorId)
        : [...current, sponsorId]
    )
  }

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

  return {
    resetCreatePanel,
    selectAuctionForEditing,
    toggleCreateSponsorInvite,
    toggleEditSponsorInvite,
    onRevertCompetitionSponsorOverride,
  }
}
