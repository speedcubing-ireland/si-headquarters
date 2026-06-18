import type { FunctionReturnType } from "convex/server"
import { useEffect, useMemo, useRef } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { SponsorBidOutcomeDisplay } from "@/plugins/sponsor/admin/types"
import { useSponsorshipAuctionManagerView } from "@/plugins/sponsor/hooks/use-sponsorship"
import type { SponsorshipAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import {
  centsToEuroInput,
  hasSameIdSet,
  normalizeSearchText,
  parseDatetimeLocalInput,
  toDatetimeLocalInput,
} from "@/plugins/sponsor/lib/sponsorship-ui"

type ManagerCompetition = FunctionReturnType<
  typeof api.plugins.sponsor.admin.auctions.management.listCompetitionsForManager
>[number]
type ManagerAuction = FunctionReturnType<
  typeof api.plugins.sponsor.admin.auctions.management.listForManager
>[number]
type ManagerSponsor = FunctionReturnType<
  typeof api.plugins.sponsor.admin.sponsors.list
>[number]

export function useSponsorshipAdminDerived({
  competitions,
  auctions,
  sponsors,
  openSearchQuery,
  closedSearchQuery,
  editorMode,
  selectedAuctionId,
  selectedClosedAuctionId,
  createCompetitionIdSelection,
  createInvitedSponsorIdsOverride,
  setCreateInvitedSponsorIdsOverride,
  editFramework,
  editStartsAtInput,
  editEndsAtInput,
  editStartPriceEuros,
  editInvitedSponsorIds,
  setEditFramework,
  setIsEditFrameworkUnlocked,
  setEditStartsAtInput,
  setEditEndsAtInput,
  setEditStartPriceEuros,
  setEditInvitedSponsorIds,
}: {
  competitions: ManagerCompetition[]
  auctions: ManagerAuction[]
  sponsors: ManagerSponsor[]
  openSearchQuery: string
  closedSearchQuery: string
  editorMode: "create" | "edit"
  selectedAuctionId: Id<"sponsorshipAuctions"> | null
  selectedClosedAuctionId: Id<"sponsorshipAuctions"> | null
  createCompetitionIdSelection: Id<"competitions"> | null
  createInvitedSponsorIdsOverride: Id<"sponsors">[] | null
  setCreateInvitedSponsorIdsOverride: Dispatch<
    SetStateAction<Id<"sponsors">[] | null>
  >
  editFramework: SponsorshipAuctionFramework
  editStartsAtInput: string
  editEndsAtInput: string
  editStartPriceEuros: string
  editInvitedSponsorIds: Id<"sponsors">[]
  setEditFramework: Dispatch<SetStateAction<SponsorshipAuctionFramework>>
  setIsEditFrameworkUnlocked: Dispatch<SetStateAction<boolean>>
  setEditStartsAtInput: Dispatch<SetStateAction<string>>
  setEditEndsAtInput: Dispatch<SetStateAction<string>>
  setEditStartPriceEuros: Dispatch<SetStateAction<string>>
  setEditInvitedSponsorIds: Dispatch<SetStateAction<Id<"sponsors">[]>>
}) {
  const lastInitializedEditAuctionIdRef =
    useRef<Id<"sponsorshipAuctions"> | null>(null)

  const activeSponsors = useMemo(
    () => sponsors.filter((sponsor) => sponsor.active),
    [sponsors]
  )
  const sponsorById = useMemo(
    () => new Map(sponsors.map((sponsor) => [sponsor.id, sponsor])),
    [sponsors]
  )
  const auctionById = useMemo(
    () => new Map(auctions.map((auction) => [auction.id, auction])),
    [auctions]
  )
  const competitionById = useMemo(
    () =>
      new Map(competitions.map((competition) => [competition.id, competition])),
    [competitions]
  )
  const competitionIdByString = useMemo(
    () =>
      new Map<string, Id<"competitions">>(
        competitions.map((competition) => [
          String(competition.id),
          competition.id,
        ])
      ),
    [competitions]
  )

  const openAuctions = useMemo(
    () => auctions.filter((auction) => auction.state !== "closed"),
    [auctions]
  )
  const closedAuctions = useMemo(
    () => auctions.filter((auction) => auction.state === "closed"),
    [auctions]
  )
  const openSearchText = normalizeSearchText(openSearchQuery)
  const closedSearchText = normalizeSearchText(closedSearchQuery)
  const filteredOpenAuctions = useMemo(
    () =>
      openAuctions.filter((auction) => {
        if (!openSearchText) return true
        return (
          auction.competitionName.toLowerCase().includes(openSearchText) ||
          auction.competitionPhaseName.toLowerCase().includes(openSearchText)
        )
      }),
    [openAuctions, openSearchText]
  )
  const filteredClosedAuctions = useMemo(
    () =>
      closedAuctions.filter((auction) => {
        if (!closedSearchText) return true
        return (
          auction.competitionName.toLowerCase().includes(closedSearchText) ||
          auction.competitionPhaseName.toLowerCase().includes(closedSearchText)
        )
      }),
    [closedAuctions, closedSearchText]
  )

  const unsponsoredCompetitionsByPhase = useMemo(() => {
    const grouped = new Map<string, (typeof competitions)[number][]>()
    for (const competition of competitions) {
      if (competition.sponsorPropertyStatus === "sponsor") continue
      const phase = competition.currentPhaseName
      const current = grouped.get(phase) ?? []
      current.push(competition)
      grouped.set(phase, current)
    }
    return [...grouped.entries()]
      .map(([phase, items]) => ({
        phase,
        items: items.sort((a, b) => a.compStart.localeCompare(b.compStart)),
      }))
      .sort((a, b) => a.phase.localeCompare(b.phase))
  }, [competitions])

  const sponsoredCompetitions = useMemo(
    () =>
      competitions
        .filter(
          (competition) => competition.sponsorPropertyStatus === "sponsor"
        )
        .sort((a, b) => a.compStart.localeCompare(b.compStart)),
    [competitions]
  )

  const defaultCreateCompetitionId = useMemo((): Id<"competitions"> | null => {
    if (competitions.length === 0) {
      return null
    }
    const preferred =
      unsponsoredCompetitionsByPhase[0]?.items[0] ?? competitions[0]
    return preferred.id
  }, [competitions, unsponsoredCompetitionsByPhase])

  const createCompetitionId: Id<"competitions"> | null =
    createCompetitionIdSelection ?? defaultCreateCompetitionId

  const defaultCreateInvitedSponsorIds = useMemo(
    () => activeSponsors.map((sponsor) => sponsor.id),
    [activeSponsors]
  )

  const createInvitedSponsorIds =
    createInvitedSponsorIdsOverride ?? defaultCreateInvitedSponsorIds

  const setCreateInvitedSponsorIds = (
    updater: SetStateAction<Id<"sponsors">[]>
  ) => {
    setCreateInvitedSponsorIdsOverride((current) => {
      const base = current ?? defaultCreateInvitedSponsorIds
      return typeof updater === "function" ? updater(base) : updater
    })
  }

  const auctionEditTargetMissing =
    editorMode === "edit" &&
    selectedAuctionId !== null &&
    !auctionById.has(selectedAuctionId)
  const effectiveEditorMode = auctionEditTargetMissing ? "create" : editorMode
  const effectiveSelectedAuctionId = auctionEditTargetMissing
    ? null
    : selectedAuctionId

  const { managerView, isLoading: isLoadingManagerView } =
    useSponsorshipAuctionManagerView(
      effectiveEditorMode === "edit" ? effectiveSelectedAuctionId : null
    )
  const {
    managerView: closedAuctionManagerView,
    isLoading: isLoadingClosedAuctionManagerView,
  } = useSponsorshipAuctionManagerView(selectedClosedAuctionId)

  useEffect(() => {
    if (managerView == null || effectiveEditorMode !== "edit") return
    if (lastInitializedEditAuctionIdRef.current === managerView.auction.id) {
      return
    }
    lastInitializedEditAuctionIdRef.current = managerView.auction.id
    setEditFramework(managerView.auction.framework)
    setIsEditFrameworkUnlocked(false)
    setEditStartsAtInput(
      toDatetimeLocalInput(new Date(managerView.auction.startsAt))
    )
    setEditEndsAtInput(
      toDatetimeLocalInput(new Date(managerView.auction.endsAt))
    )
    setEditStartPriceEuros(
      centsToEuroInput(managerView.auction.startPriceCents)
    )
    setEditInvitedSponsorIds(managerView.inviteSponsorIds)
  }, [
    effectiveEditorMode,
    managerView,
    setEditEndsAtInput,
    setEditFramework,
    setEditInvitedSponsorIds,
    setEditStartPriceEuros,
    setEditStartsAtInput,
    setIsEditFrameworkUnlocked,
  ])

  useEffect(() => {
    if (effectiveEditorMode === "edit" && effectiveSelectedAuctionId !== null) {
      return
    }
    lastInitializedEditAuctionIdRef.current = null
  }, [effectiveEditorMode, effectiveSelectedAuctionId])

  const selectedAuction =
    effectiveEditorMode === "edit" && effectiveSelectedAuctionId !== null
      ? (auctionById.get(effectiveSelectedAuctionId) ?? null)
      : null

  const selectedClosedAuction = useMemo(() => {
    if (selectedClosedAuctionId === null) return null
    const auction = auctionById.get(selectedClosedAuctionId) ?? null
    return auction?.state === "closed" ? auction : null
  }, [auctionById, selectedClosedAuctionId])

  const selectedClosedAuctionWinnerName = selectedClosedAuction?.winnerSponsorId
    ? (sponsorById.get(selectedClosedAuction.winnerSponsorId)?.name ??
      "Unknown sponsor")
    : "No winner"

  const selectedClosedAuctionWinningBidCents = selectedClosedAuction
    ? (selectedClosedAuction.settlementAmountCents ??
      selectedClosedAuction.currentPriceCents ??
      selectedClosedAuction.startPriceCents)
    : null

  const selectedClosedAuctionInvitedSponsors =
    closedAuctionManagerView?.inviteSponsorIds.map((sponsorId) => ({
      sponsorId,
      sponsorName: sponsorById.get(sponsorId)?.name ?? "Unknown sponsor",
    })) ?? []

  const selectedClosedAuctionSponsorOutcomes: SponsorBidOutcomeDisplay[] = (
    closedAuctionManagerView?.sponsorOutcomes ?? []
  ).map((outcome) => ({
    ...outcome,
    sponsorName: sponsorById.get(outcome.sponsorId)?.name ?? "Unknown sponsor",
  }))

  const selectedOpenAuctionSponsorOutcomes: SponsorBidOutcomeDisplay[] = (
    managerView?.sponsorOutcomes ?? []
  ).map((outcome) => ({
    ...outcome,
    sponsorName: sponsorById.get(outcome.sponsorId)?.name ?? "Unknown sponsor",
  }))

  const selectedAuctionCompetitionSummary =
    managerView?.competitionSummary ?? null
  const selectedAuctionCompetitionSummarySource =
    managerView?.competitionSummarySource ?? null
  const selectedAuctionCompetitionSummaryFetchedAt =
    managerView?.competitionSummaryFetchedAt
  const isSelectedAuctionCompetitionSummaryReady =
    selectedAuctionCompetitionSummarySource === "wca"

  const selectedCompetition =
    createCompetitionId === null
      ? null
      : (competitionById.get(createCompetitionId) ?? null)

  const panelCompetitionId =
    effectiveEditorMode === "edit"
      ? (selectedAuction?.competitionId ?? null)
      : createCompetitionId

  const panelCompetition =
    panelCompetitionId !== null
      ? (competitionById.get(panelCompetitionId) ?? null)
      : null

  const panelCompetitionHasManualSponsorOverride =
    panelCompetition?.manualSponsorPropertyStatus !== undefined ||
    panelCompetition?.manualSponsorId !== undefined

  const panelCompetitionManualSponsorName = panelCompetition?.manualSponsorId
    ? (sponsorById.get(panelCompetition.manualSponsorId)?.name ?? "Sponsor")
    : undefined

  const previousClosedAuctionsForPanel = useMemo(() => {
    if (!panelCompetitionId) return []
    return auctions
      .filter(
        (auction) =>
          auction.state === "closed" &&
          auction.competitionId === panelCompetitionId &&
          auction.id !== selectedAuction?.id
      )
      .sort((a, b) => b.endsAt - a.endsAt)
      .slice(0, 5)
  }, [auctions, panelCompetitionId, selectedAuction?.id])

  const hasPendingEditChanges = useMemo(() => {
    if (effectiveEditorMode !== "edit" || managerView == null) return false
    const startsAt = parseDatetimeLocalInput(editStartsAtInput)
    const endsAt = parseDatetimeLocalInput(editEndsAtInput)
    const startPrice = Number(editStartPriceEuros)
    const startPriceCents = Number.isFinite(startPrice)
      ? Math.round(startPrice * 100)
      : null
    return (
      editFramework !== managerView.auction.framework ||
      startsAt !== managerView.auction.startsAt ||
      endsAt !== managerView.auction.endsAt ||
      startPriceCents !== managerView.auction.startPriceCents ||
      !hasSameIdSet(editInvitedSponsorIds, managerView.inviteSponsorIds)
    )
  }, [
    editEndsAtInput,
    editFramework,
    editInvitedSponsorIds,
    editStartPriceEuros,
    editStartsAtInput,
    effectiveEditorMode,
    managerView,
  ])

  return {
    activeSponsors,
    sponsorById,
    auctionById,
    competitionById,
    competitionIdByString,
    openAuctions,
    closedAuctions,
    filteredOpenAuctions,
    filteredClosedAuctions,
    unsponsoredCompetitionsByPhase,
    sponsoredCompetitions,
    defaultCreateCompetitionId,
    createCompetitionId,
    defaultCreateInvitedSponsorIds,
    createInvitedSponsorIds,
    setCreateInvitedSponsorIds,
    effectiveEditorMode,
    effectiveSelectedAuctionId,
    managerView,
    isLoadingManagerView,
    closedAuctionManagerView,
    isLoadingClosedAuctionManagerView,
    selectedAuction,
    selectedClosedAuction,
    selectedClosedAuctionWinnerName,
    selectedClosedAuctionWinningBidCents,
    selectedClosedAuctionInvitedSponsors,
    selectedClosedAuctionSponsorOutcomes,
    selectedOpenAuctionSponsorOutcomes,
    selectedAuctionCompetitionSummary,
    selectedAuctionCompetitionSummarySource,
    selectedAuctionCompetitionSummaryFetchedAt,
    isSelectedAuctionCompetitionSummaryReady,
    selectedCompetition,
    panelCompetitionId,
    panelCompetition,
    panelCompetitionHasManualSponsorOverride,
    panelCompetitionManualSponsorName,
    previousClosedAuctionsForPanel,
    hasPendingEditChanges,
  }
}
