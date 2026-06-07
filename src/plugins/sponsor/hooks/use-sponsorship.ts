import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
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

export function useSponsorContacts(sponsorId: Id<"sponsors"> | null) {
  const contacts = useQuery(
    api.plugins.sponsor.admin.contacts.listBySponsor,
    sponsorId !== null ? { sponsorId } : "skip"
  )
  return {
    contacts: contacts ?? [],
    isLoading: sponsorId !== null && contacts === undefined,
  }
}

export function useSponsorContactMutations() {
  const createContact = useMutation(api.plugins.sponsor.admin.contacts.create)
  const updateContact = useMutation(api.plugins.sponsor.admin.contacts.update)
  const sendContactAccessEmail = useMutation(
    api.plugins.sponsor.admin.contacts.sendAccessEmail
  )
  const revokeContactSessions = useMutation(
    api.plugins.sponsor.admin.contacts.revokeSessions
  )
  const setPrimaryContact = useMutation(
    api.plugins.sponsor.admin.contacts.setPrimary
  )

  return {
    createContact,
    updateContact,
    sendContactAccessEmail,
    revokeContactSessions,
    setPrimaryContact,
    archiveContact: (contactId: Id<"sponsorContacts">) =>
      updateContact({ contactId, active: false }),
    unarchiveContact: (contactId: Id<"sponsorContacts">) =>
      updateContact({ contactId, active: true }),
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
