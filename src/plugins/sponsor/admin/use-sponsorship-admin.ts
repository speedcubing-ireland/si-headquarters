import { useMemo, useState } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { buildAuctionActions } from "@/plugins/sponsor/admin/actions/build-auction-actions"
import { buildEditorActions } from "@/plugins/sponsor/admin/actions/build-editor-actions"
import { buildSponsorActions } from "@/plugins/sponsor/admin/actions/build-sponsor-actions"
import { useSponsorshipAdminDerived } from "@/plugins/sponsor/admin/use-sponsorship-admin-derived"
import { useCompetitionSponsorOverride } from "@/plugins/sponsor/hooks/competition-sponsor-property"
import {
  useSponsorshipAuctionMutations,
  useSponsorshipAuctionsForManager,
  useSponsorshipCompetitionsForManager,
  useSponsorMutations,
  useSponsors,
} from "@/plugins/sponsor/hooks/use-sponsorship"
import type { SponsorshipAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import { toDatetimeLocalInput } from "@/plugins/sponsor/lib/sponsorship-ui"

export function useSponsorshipAdmin() {
  const { competitions, isLoading: isLoadingCompetitions } =
    useSponsorshipCompetitionsForManager()
  const { auctions, isLoading: isLoadingAuctions } =
    useSponsorshipAuctionsForManager()
  const { sponsors, isLoading: isLoadingSponsors } = useSponsors()
  const { setCompetitionSponsorOverride } = useCompetitionSponsorOverride()
  const {
    createSponsor,
    archiveSponsor,
    unarchiveSponsor,
    sendAccessEmail,
    revokeSessions,
  } = useSponsorMutations()
  const {
    createAuction,
    updateAuction,
    refreshCompetitionSnapshot,
    startAuction,
    closeAuction,
    deleteBeforeOpen,
  } = useSponsorshipAuctionMutations()

  const [openSearchQuery, setOpenSearchQuery] = useState("")
  const [closedSearchQuery, setClosedSearchQuery] = useState("")
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create")
  const [selectedAuctionId, setSelectedAuctionId] =
    useState<Id<"sponsorshipAuctions"> | null>(null)
  const [selectedClosedAuctionId, setSelectedClosedAuctionId] =
    useState<Id<"sponsorshipAuctions"> | null>(null)

  const [createCompetitionIdSelection, setCreateCompetitionIdSelection] =
    useState<Id<"competitions"> | null>(null)
  const [createStartsAtInput, setCreateStartsAtInput] = useState(() =>
    toDatetimeLocalInput(new Date(Date.now() + 60 * 60 * 1000))
  )
  const [createEndsAtInput, setCreateEndsAtInput] = useState(() =>
    toDatetimeLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000))
  )
  const [createFramework, setCreateFramework] =
    useState<SponsorshipAuctionFramework>("first_sealed")
  const [isCreateFrameworkUnlocked, setIsCreateFrameworkUnlocked] =
    useState(false)
  const [createStartPriceEuros, setCreateStartPriceEuros] = useState("100")
  const [createInvitedSponsorIdsOverride, setCreateInvitedSponsorIdsOverride] =
    useState<Id<"sponsors">[] | null>(null)

  const [editFramework, setEditFramework] =
    useState<SponsorshipAuctionFramework>("first_sealed")
  const [isEditFrameworkUnlocked, setIsEditFrameworkUnlocked] = useState(false)
  const [editStartsAtInput, setEditStartsAtInput] = useState("")
  const [editEndsAtInput, setEditEndsAtInput] = useState("")
  const [editStartPriceEuros, setEditStartPriceEuros] = useState("")
  const [editInvitedSponsorIds, setEditInvitedSponsorIds] = useState<
    Id<"sponsors">[]
  >([])

  const [isCreatingAuction, setIsCreatingAuction] = useState(false)
  const [isSavingAuction, setIsSavingAuction] = useState(false)
  const [busyAuctionId, setBusyAuctionId] =
    useState<Id<"sponsorshipAuctions"> | null>(null)
  const [refreshingAuctionId, setRefreshingAuctionId] =
    useState<Id<"sponsorshipAuctions"> | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [isSubmittingSponsor, setIsSubmittingSponsor] = useState(false)
  const [busySponsorId, setBusySponsorId] = useState<Id<"sponsors"> | null>(
    null
  )
  const [busyCompetitionId, setBusyCompetitionId] =
    useState<Id<"competitions"> | null>(null)

  const derived = useSponsorshipAdminDerived({
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
  })

  const editorActions = useMemo(
    () =>
      buildEditorActions({
        activeSponsors: derived.activeSponsors,
        setCompetitionSponsorOverride,
        setEditorMode,
        setSelectedAuctionId,
        setCreateFramework,
        setIsCreateFrameworkUnlocked,
        setCreateStartsAtInput,
        setCreateEndsAtInput,
        setCreateStartPriceEuros,
        setCreateInvitedSponsorIds: derived.setCreateInvitedSponsorIds,
        setCreateCompetitionIdSelection,
        setIsEditFrameworkUnlocked,
        setEditInvitedSponsorIds,
        setBusyCompetitionId,
      }),
    [
      derived.activeSponsors,
      derived.setCreateInvitedSponsorIds,
      setCompetitionSponsorOverride,
    ]
  )

  const auctionActions = useMemo(
    () =>
      buildAuctionActions({
        createCompetitionId: derived.createCompetitionId,
        createInvitedSponsorIds: derived.createInvitedSponsorIds,
        createStartsAtInput,
        createEndsAtInput,
        createFramework,
        createStartPriceEuros,
        editInvitedSponsorIds,
        editStartsAtInput,
        editEndsAtInput,
        editFramework,
        editStartPriceEuros,
        effectiveSelectedAuctionId: derived.effectiveSelectedAuctionId,
        managerView: derived.managerView,
        hasPendingEditChanges: derived.hasPendingEditChanges,
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
        resetCreatePanel: editorActions.resetCreatePanel,
      }),
    [
      derived.createCompetitionId,
      derived.createInvitedSponsorIds,
      derived.effectiveSelectedAuctionId,
      derived.managerView,
      derived.hasPendingEditChanges,
      createStartsAtInput,
      createEndsAtInput,
      createFramework,
      createStartPriceEuros,
      editInvitedSponsorIds,
      editStartsAtInput,
      editEndsAtInput,
      editFramework,
      editStartPriceEuros,
      createAuction,
      updateAuction,
      refreshCompetitionSnapshot,
      startAuction,
      closeAuction,
      deleteBeforeOpen,
      editorActions.resetCreatePanel,
    ]
  )

  const sponsorActions = useMemo(
    () =>
      buildSponsorActions({
        name,
        email,
        avatarUrl,
        createSponsor,
        sendAccessEmail,
        revokeSessions,
        archiveSponsor,
        unarchiveSponsor,
        setName,
        setEmail,
        setAvatarUrl,
        setIsSubmittingSponsor,
        setBusySponsorId,
      }),
    [
      name,
      email,
      avatarUrl,
      createSponsor,
      sendAccessEmail,
      revokeSessions,
      archiveSponsor,
      unarchiveSponsor,
    ]
  )

  return {
    stats: {
      openAuctions: derived.openAuctions,
      closedAuctions: derived.closedAuctions,
      activeSponsors: derived.activeSponsors,
      competitions,
      needsSponsorCount: competitions.filter(
        (c) => c.sponsorPropertyStatus !== "sponsor"
      ).length,
    },
    loading: {
      isLoadingCompetitions,
      isLoadingAuctions,
      isLoadingSponsors,
      isLoadingManagerView: derived.isLoadingManagerView,
      isLoadingClosedAuctionManagerView:
        derived.isLoadingClosedAuctionManagerView,
    },
    open: {
      openSearchQuery,
      setOpenSearchQuery,
      filteredOpenAuctions: derived.filteredOpenAuctions,
      effectiveEditorMode: derived.effectiveEditorMode,
      effectiveSelectedAuctionId: derived.effectiveSelectedAuctionId,
      isCreatingAuction,
      isSavingAuction,
      busyAuctionId,
      refreshingAuctionId,
      createCompetitionId: derived.createCompetitionId,
      createStartsAtInput,
      setCreateStartsAtInput,
      createEndsAtInput,
      setCreateEndsAtInput,
      createFramework,
      setCreateFramework,
      isCreateFrameworkUnlocked,
      setIsCreateFrameworkUnlocked,
      createStartPriceEuros,
      setCreateStartPriceEuros,
      createInvitedSponsorIds: derived.createInvitedSponsorIds,
      activeSponsors: derived.activeSponsors,
      editFramework,
      setEditFramework,
      isEditFrameworkUnlocked,
      setIsEditFrameworkUnlocked,
      editStartsAtInput,
      setEditStartsAtInput,
      editEndsAtInput,
      setEditEndsAtInput,
      editStartPriceEuros,
      setEditStartPriceEuros,
      editInvitedSponsorIds,
      managerView: derived.managerView,
      selectedAuction: derived.selectedAuction,
      hasPendingEditChanges: derived.hasPendingEditChanges,
      selectedCompetition: derived.selectedCompetition,
      unsponsoredCompetitionsByPhase: derived.unsponsoredCompetitionsByPhase,
      sponsoredCompetitions: derived.sponsoredCompetitions,
      competitionIdByString: derived.competitionIdByString,
      selectedOpenAuctionSponsorOutcomes:
        derived.selectedOpenAuctionSponsorOutcomes,
      selectedAuctionCompetitionSummary:
        derived.selectedAuctionCompetitionSummary,
      selectedAuctionCompetitionSummaryFetchedAt:
        derived.selectedAuctionCompetitionSummaryFetchedAt,
      isSelectedAuctionCompetitionSummaryReady:
        derived.isSelectedAuctionCompetitionSummaryReady,
      panelCompetitionId: derived.panelCompetitionId,
      panelCompetition: derived.panelCompetition,
      panelCompetitionHasManualSponsorOverride:
        derived.panelCompetitionHasManualSponsorOverride,
      panelCompetitionManualSponsorName:
        derived.panelCompetitionManualSponsorName,
      previousClosedAuctionsForPanel: derived.previousClosedAuctionsForPanel,
      busyCompetitionId,
    },
    closed: {
      closedSearchQuery,
      setClosedSearchQuery,
      filteredClosedAuctions: derived.filteredClosedAuctions,
      selectedClosedAuctionId,
      setSelectedClosedAuctionId,
      selectedClosedAuction: derived.selectedClosedAuction,
      selectedClosedAuctionWinnerName: derived.selectedClosedAuctionWinnerName,
      selectedClosedAuctionWinningBidCents:
        derived.selectedClosedAuctionWinningBidCents,
      selectedClosedAuctionInvitedSponsors:
        derived.selectedClosedAuctionInvitedSponsors,
      selectedClosedAuctionSponsorOutcomes:
        derived.selectedClosedAuctionSponsorOutcomes,
      closedAuctionManagerView: derived.closedAuctionManagerView,
    },
    sponsors: {
      sponsors,
      name,
      setName,
      email,
      setEmail,
      avatarUrl,
      setAvatarUrl,
      isSubmittingSponsor,
      busySponsorId,
    },
    actions: {
      ...editorActions,
      ...auctionActions,
      ...sponsorActions,
      setCreateCompetitionIdSelection,
      setEditInvitedSponsorIds,
    },
    maps: {
      sponsorById: derived.sponsorById,
      auctionById: derived.auctionById,
    },
  }
}

export type SponsorshipAdmin = ReturnType<typeof useSponsorshipAdmin>
