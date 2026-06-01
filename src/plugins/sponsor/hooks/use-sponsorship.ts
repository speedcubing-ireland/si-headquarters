import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { CompetitionSponsorPropertyStatus } from "@/plugins/sponsor/lib/sponsorship-ui"

export function useSponsors(enabled = true) {
  const sponsors = useQuery(
    api.plugins.sponsor.admin.sponsors.list,
    enabled ? {} : "skip"
  )
  return {
    sponsors: sponsors ?? [],
    isLoading: enabled && sponsors === undefined,
  }
}

export function useSponsorMutations() {
  const createSponsor = useMutation(api.plugins.sponsor.admin.sponsors.create)
  const updateSponsor = useMutation(api.plugins.sponsor.admin.sponsors.update)
  const sendAccessEmailMut = useMutation(
    api.plugins.sponsor.admin.sponsors.sendAccessEmail
  )
  const revokeSessions = useMutation(
    api.plugins.sponsor.admin.sponsors.revokeSessions
  )
  const setSponsorActive = (sponsorId: Id<"sponsors">, active: boolean) =>
    updateSponsor({ sponsorId, active })

  return {
    createSponsor,
    updateSponsor,
    setSponsorActive,
    archiveSponsor: (sponsorId: Id<"sponsors">) =>
      setSponsorActive(sponsorId, false),
    unarchiveSponsor: (sponsorId: Id<"sponsors">) =>
      setSponsorActive(sponsorId, true),
    sendAccessEmail: (sponsorId: Id<"sponsors">) =>
      sendAccessEmailMut({ sponsorId }),
    revokeSessions: (sponsorId: Id<"sponsors">) =>
      revokeSessions({ sponsorId }),
  }
}

export function useSponsorshipCompetitionsForManager(enabled = true) {
  const competitions = useQuery(
    api.plugins.sponsor.admin.auctions.management.listCompetitionsForManager,
    enabled ? {} : "skip"
  )
  return {
    competitions: competitions ?? [],
    isLoading: enabled && competitions === undefined,
  }
}

export function useSponsorshipAuctionsForManager(enabled = true) {
  const auctions = useQuery(
    api.plugins.sponsor.admin.auctions.management.listForManager,
    enabled ? {} : "skip"
  )
  return {
    auctions: auctions ?? [],
    isLoading: enabled && auctions === undefined,
  }
}

export function useSponsorshipAuctionManagerView(
  auctionId: Id<"sponsorshipAuctions"> | null,
  enabled = true
) {
  const managerView = useQuery(
    api.plugins.sponsor.admin.auctions.management.getManagerView,
    auctionId !== null && enabled ? { auctionId } : "skip"
  )
  return {
    managerView: managerView ?? null,
    isLoading: enabled && auctionId !== null && managerView === undefined,
  }
}

export function useSponsorshipAuctionMutations() {
  const createAuction = useMutation(
    api.plugins.sponsor.admin.auctions.management.create
  )
  const updateAuction = useMutation(
    api.plugins.sponsor.admin.auctions.management.update
  )
  const startAuction = useMutation(
    api.plugins.sponsor.admin.auctions.lifecycle.start
  )
  const closeAuction = useMutation(
    api.plugins.sponsor.admin.auctions.lifecycle.close
  )
  const refreshCompetitionSnapshot = useAction(
    api.plugins.sponsor.admin.auctions.competitionSnapshot
      .refreshCompetitionSnapshot
  )
  const deleteBeforeOpen = useMutation(
    api.plugins.sponsor.admin.auctions.management.removeBeforeOpen
  )

  return {
    createAuction,
    updateAuction,
    refreshCompetitionSnapshot: (auctionId: Id<"sponsorshipAuctions">) =>
      refreshCompetitionSnapshot({ auctionId }),
    startAuction: (auctionId: Id<"sponsorshipAuctions">) =>
      startAuction({ auctionId }),
    closeAuction: (auctionId: Id<"sponsorshipAuctions">) =>
      closeAuction({ auctionId }),
    deleteBeforeOpen: (auctionId: Id<"sponsorshipAuctions">) =>
      deleteBeforeOpen({ auctionId }),
  }
}

export function useCompetitionMutations() {
  const setManualOverride = useMutation(
    api.plugins.sponsor.admin.propertyStatus.setManualOverride
  )

  return {
    updateCompetition: async (
      competitionId: Id<"competitions">,
      input: {
        sponsorPropertyStatusOverride: CompetitionSponsorPropertyStatus | null
        sponsorOverrideSponsorId: Id<"sponsors"> | null
      }
    ) => {
      await setManualOverride({
        competitionId,
        status: input.sponsorPropertyStatusOverride ?? undefined,
        manualSponsorId: input.sponsorOverrideSponsorId ?? undefined,
      })
    },
  }
}
