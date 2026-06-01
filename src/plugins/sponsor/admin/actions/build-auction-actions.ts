import type { Dispatch, SetStateAction, SubmitEvent } from "react"
import { toast } from "sonner"
import type { Id } from "@/convex/_generated/dataModel"
import {
  parseDatetimeLocalInput,
  type SponsorshipFramework,
} from "@/plugins/sponsor/lib/sponsorship-ui"

interface ManagerView {
  auction: {
    id: Id<"sponsorshipAuctions">
    state: string
    framework: SponsorshipFramework
    startsAt: number
    endsAt: number
    startPriceCents: number
  }
  inviteSponsorIds: Id<"sponsors">[]
}

export interface AuctionActionsDeps {
  createCompetitionId: Id<"competitions"> | null
  createInvitedSponsorIds: Id<"sponsors">[]
  createStartsAtInput: string
  createEndsAtInput: string
  createFramework: SponsorshipFramework
  createStartPriceEuros: string
  editInvitedSponsorIds: Id<"sponsors">[]
  editStartsAtInput: string
  editEndsAtInput: string
  editFramework: SponsorshipFramework
  editStartPriceEuros: string
  effectiveSelectedAuctionId: Id<"sponsorshipAuctions"> | null
  managerView: ManagerView | null | undefined
  hasPendingEditChanges: boolean
  createAuction: (args: {
    competitionId: Id<"competitions">
    framework: SponsorshipFramework
    startsAt: number
    endsAt: number
    startPriceCents: number
    invitedSponsorIds: Id<"sponsors">[]
  }) => Promise<Id<"sponsorshipAuctions">>
  updateAuction: (args: {
    auctionId: Id<"sponsorshipAuctions">
    framework: SponsorshipFramework
    startsAt: number
    endsAt: number
    startPriceCents: number
    invitedSponsorIds: Id<"sponsors">[]
  }) => Promise<null>
  refreshCompetitionSnapshot: (auctionId: Id<"sponsorshipAuctions">) => Promise<{
    status: string
    message: string
  }>
  startAuction: (auctionId: Id<"sponsorshipAuctions">) => Promise<null>
  closeAuction: (auctionId: Id<"sponsorshipAuctions">) => Promise<null>
  deleteBeforeOpen: (auctionId: Id<"sponsorshipAuctions">) => Promise<null>
  setIsCreatingAuction: Dispatch<SetStateAction<boolean>>
  setIsSavingAuction: Dispatch<SetStateAction<boolean>>
  setBusyAuctionId: Dispatch<SetStateAction<Id<"sponsorshipAuctions"> | null>>
  setRefreshingAuctionId: Dispatch<
    SetStateAction<Id<"sponsorshipAuctions"> | null>
  >
  setSelectedAuctionId: Dispatch<
    SetStateAction<Id<"sponsorshipAuctions"> | null>
  >
  setEditorMode: Dispatch<SetStateAction<"create" | "edit">>
  resetCreatePanel: () => void
}

export function buildAuctionActions(deps: AuctionActionsDeps) {
  const {
    createCompetitionId,
    createInvitedSponsorIds,
    createStartsAtInput,
    createEndsAtInput,
    createFramework,
    createStartPriceEuros,
    editInvitedSponsorIds,
    editStartsAtInput,
    editEndsAtInput,
    editFramework,
    editStartPriceEuros,
    effectiveSelectedAuctionId,
    managerView,
    hasPendingEditChanges,
    createAuction,
    updateAuction,
    refreshCompetitionSnapshot,
    startAuction,
    closeAuction,
    deleteBeforeOpen,
    setIsCreatingAuction,
    setIsSavingAuction,
    setBusyAuctionId,
    setRefreshingAuctionId,
    setSelectedAuctionId,
    setEditorMode,
    resetCreatePanel,
  } = deps

  const onRefreshAuctionCompetitionData = async (
    auctionId: Id<"sponsorshipAuctions">,
    notify = true,
  ) => {
    setRefreshingAuctionId(auctionId)
    try {
      const result = await refreshCompetitionSnapshot(auctionId)
      if (notify) {
        if (result.status === "ready") {
          toast.success("Competition details synced from WCA.")
        } else {
          toast.error(result.message)
        }
      }
      return result
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to refresh competition details."
      if (notify) {
        toast.error(message)
      }
      throw error
    } finally {
      setRefreshingAuctionId(null)
    }
  }

  const onCreateAuction = async (event: SubmitEvent) => {
    event.preventDefault()
    if (createCompetitionId === null) {
      toast.error("Select a competition first.")
      return
    }
    if (createInvitedSponsorIds.length === 0) {
      toast.error("Select at least one invited sponsor.")
      return
    }
    const startsAt = parseDatetimeLocalInput(createStartsAtInput)
    const endsAt = parseDatetimeLocalInput(createEndsAtInput)
    if (startsAt === null || endsAt === null || endsAt <= startsAt) {
      toast.error("Enter a valid start/end range.")
      return
    }
    const startPrice = Number(createStartPriceEuros)
    if (!Number.isFinite(startPrice) || startPrice < 1) {
      toast.error("Start price must be at least EUR 1.00.")
      return
    }

    setIsCreatingAuction(true)
    try {
      const auctionId = await createAuction({
        competitionId: createCompetitionId,
        framework: createFramework,
        startsAt,
        endsAt,
        startPriceCents: Math.round(startPrice * 100),
        invitedSponsorIds: createInvitedSponsorIds,
      })
      toast.success("Auction draft created.")
      void onRefreshAuctionCompetitionData(auctionId, false)
      setSelectedAuctionId(auctionId)
      setEditorMode("edit")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create auction."
      toast.error(message)
    } finally {
      setIsCreatingAuction(false)
    }
  }

  const onSaveAuctionChanges = async (event: SubmitEvent) => {
    event.preventDefault()
    if (effectiveSelectedAuctionId === null || managerView == null) {
      return
    }
    if (
      managerView.auction.state === "active" ||
      managerView.auction.state === "closed"
    ) {
      toast.error("Only draft or scheduled auctions can be edited.")
      return
    }
    if (editInvitedSponsorIds.length === 0) {
      toast.error("Select at least one invited sponsor.")
      return
    }
    const startsAt = parseDatetimeLocalInput(editStartsAtInput)
    const endsAt = parseDatetimeLocalInput(editEndsAtInput)
    if (startsAt === null || endsAt === null || endsAt <= startsAt) {
      toast.error("Enter a valid start/end range.")
      return
    }
    const startPrice = Number(editStartPriceEuros)
    if (!Number.isFinite(startPrice) || startPrice < 1) {
      toast.error("Start price must be at least EUR 1.00.")
      return
    }

    setIsSavingAuction(true)
    try {
      await updateAuction({
        auctionId: effectiveSelectedAuctionId,
        framework: editFramework,
        startsAt,
        endsAt,
        startPriceCents: Math.round(startPrice * 100),
        invitedSponsorIds: editInvitedSponsorIds,
      })
      await refreshCompetitionSnapshot(effectiveSelectedAuctionId).catch(
        () => undefined,
      )
      toast.success("Auction updated.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update auction."
      toast.error(message)
    } finally {
      setIsSavingAuction(false)
    }
  }

  const onStartAuction = async (auctionId: Id<"sponsorshipAuctions">) => {
    if (hasPendingEditChanges) {
      toast.error("Save pending changes before starting this auction.")
      return
    }
    setBusyAuctionId(auctionId)
    try {
      const refreshResult = await onRefreshAuctionCompetitionData(
        auctionId,
        false,
      )
      if (refreshResult.status !== "ready") {
        toast.error(refreshResult.message)
        return
      }
      await startAuction(auctionId)
      toast.success("Auction started.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start auction."
      toast.error(message)
    } finally {
      setBusyAuctionId(null)
    }
  }

  const onCloseAuction = async (auctionId: Id<"sponsorshipAuctions">) => {
    if (hasPendingEditChanges) {
      toast.error("Save pending changes before closing this auction.")
      return
    }
    setBusyAuctionId(auctionId)
    try {
      await closeAuction(auctionId)
      toast.success("Auction closed.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to close auction."
      toast.error(message)
    } finally {
      setBusyAuctionId(null)
    }
  }

  const onDeleteBeforeOpen = async (auctionId: Id<"sponsorshipAuctions">) => {
    const shouldDelete = window.confirm(
      "Delete this draft/scheduled auction? This cannot be undone.",
    )
    if (!shouldDelete) return
    setBusyAuctionId(auctionId)
    try {
      await deleteBeforeOpen(auctionId)
      toast.success("Auction deleted.")
      if (effectiveSelectedAuctionId === auctionId) {
        resetCreatePanel()
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete auction."
      toast.error(message)
    } finally {
      setBusyAuctionId(null)
    }
  }

  return {
    onCreateAuction,
    onSaveAuctionChanges,
    onRefreshAuctionCompetitionData,
    onStartAuction,
    onCloseAuction,
    onDeleteBeforeOpen,
  }
}
