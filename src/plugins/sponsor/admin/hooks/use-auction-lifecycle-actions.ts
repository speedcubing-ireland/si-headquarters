import { useState } from "react"
import { toast } from "sonner"
import type { Id } from "@/convex/_generated/dataModel"
import { useSponsorshipAuctionMutations } from "@/plugins/sponsor/hooks/use-sponsorship"

export function useAuctionLifecycleActions({
  onDeleted,
}: {
  onDeleted?: (auctionId: Id<"sponsorshipAuctions">) => void
} = {}) {
  const {
    refreshCompetitionSnapshot,
    startAuction,
    closeAuction,
    deleteBeforeOpen,
  } = useSponsorshipAuctionMutations()
  const [busyAuctionId, setBusyAuctionId] =
    useState<Id<"sponsorshipAuctions"> | null>(null)
  const [refreshingAuctionId, setRefreshingAuctionId] =
    useState<Id<"sponsorshipAuctions"> | null>(null)

  const onRefreshAuctionCompetitionData = async (
    auctionId: Id<"sponsorshipAuctions">,
    notify = true
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

  const onStartAuction = async (
    auctionId: Id<"sponsorshipAuctions">,
    hasPendingEdits: boolean
  ) => {
    if (hasPendingEdits) {
      toast.error("Save pending changes before starting this auction.")
      return
    }
    setBusyAuctionId(auctionId)
    try {
      const refreshResult = await onRefreshAuctionCompetitionData(
        auctionId,
        false
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

  const onCloseAuction = async (
    auctionId: Id<"sponsorshipAuctions">,
    hasPendingEdits: boolean
  ) => {
    if (hasPendingEdits) {
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
      "Delete this draft/scheduled auction? This cannot be undone."
    )
    if (!shouldDelete) return
    setBusyAuctionId(auctionId)
    try {
      await deleteBeforeOpen(auctionId)
      toast.success("Auction deleted.")
      onDeleted?.(auctionId)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete auction."
      toast.error(message)
    } finally {
      setBusyAuctionId(null)
    }
  }

  return {
    busyAuctionId,
    refreshingAuctionId,
    onRefreshAuctionCompetitionData,
    onStartAuction,
    onCloseAuction,
    onDeleteBeforeOpen,
  }
}
