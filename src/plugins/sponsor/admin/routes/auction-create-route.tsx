import { ArrowLeft } from "lucide-react"
import { useMemo, useState, type SubmitEvent } from "react"
import { toast } from "sonner"
import { Page, PAGE_CONTENT_PADDING } from "@/components/layout/page"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AbilityRouteGuard } from "@/features/auth"
import { cn } from "@/lib/utils"
import type { Id } from "@/convex/_generated/dataModel"
import type { SponsorshipAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import { AuctionCreateForm } from "@/plugins/sponsor/admin/components/auction-create-form"
import { AuctionPanelHistory } from "@/plugins/sponsor/admin/components/auction-panel-history"
import { validateAuctionFormInputs } from "@/plugins/sponsor/admin/auction-editor-draft"
import { groupUnsponsoredCompetitionsByPhase } from "@/plugins/sponsor/admin/sponsorship-admin-derivations"
import { useAuctionLifecycleActions } from "@/plugins/sponsor/admin/hooks/use-auction-lifecycle-actions"
import { useCompetitionOverrideRevert } from "@/plugins/sponsor/admin/hooks/use-competition-override-revert"
import { useSponsorshipEditorNavigation } from "@/plugins/sponsor/admin/use-sponsorship-admin-search"
import { toDatetimeLocalInput } from "@/plugins/sponsor/lib/sponsorship-ui"
import {
  useSponsors,
  useSponsorshipAuctionMutations,
  useSponsorshipAuctionsForManager,
  useSponsorshipCompetitionsForManager,
} from "@/plugins/sponsor/hooks/use-sponsorship"

export function AuctionCreateRoute() {
  return (
    <AbilityRouteGuard
      action="access"
      subject="SponsorPortalAdmin"
      deniedMessage="Directors or Finance Team access is required."
      loadingMessage="Loading sponsorship admin…"
    >
      <AuctionCreateContent />
    </AbilityRouteGuard>
  )
}

function AuctionCreateContent() {
  const { openEditAuction, backToList, viewClosedAuction } =
    useSponsorshipEditorNavigation()
  const { competitions } = useSponsorshipCompetitionsForManager()
  const { auctions } = useSponsorshipAuctionsForManager()
  const { sponsors } = useSponsors()
  const { createAuction } = useSponsorshipAuctionMutations()
  const { onRefreshAuctionCompetitionData } = useAuctionLifecycleActions()
  const { busyCompetitionId, onRevertCompetitionSponsorOverride } =
    useCompetitionOverrideRevert()

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
  const [isCreatingAuction, setIsCreatingAuction] = useState(false)

  const activeSponsors = useMemo(
    () => sponsors.filter((sponsor) => sponsor.active),
    [sponsors]
  )
  const sponsorById = useMemo(
    () => new Map(sponsors.map((sponsor) => [sponsor.id, sponsor])),
    [sponsors]
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
  const unsponsoredCompetitionsByPhase = useMemo(
    () => groupUnsponsoredCompetitionsByPhase(competitions),
    [competitions]
  )
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
    if (competitions.length === 0) return null
    return (unsponsoredCompetitionsByPhase[0]?.items[0] ?? competitions[0]).id
  }, [competitions, unsponsoredCompetitionsByPhase])

  const createCompetitionId =
    createCompetitionIdSelection ?? defaultCreateCompetitionId
  const defaultCreateInvitedSponsorIds = useMemo(
    () => activeSponsors.map((sponsor) => sponsor.id),
    [activeSponsors]
  )
  const createInvitedSponsorIds =
    createInvitedSponsorIdsOverride ?? defaultCreateInvitedSponsorIds
  const selectedCompetition =
    createCompetitionId === null
      ? null
      : (competitionById.get(createCompetitionId) ?? null)

  const previousClosedAuctionsForPanel = useMemo(() => {
    if (createCompetitionId === null) return []
    return auctions
      .filter(
        (auction) =>
          auction.state === "closed" &&
          auction.competitionId === createCompetitionId
      )
      .sort((a, b) => b.endsAt - a.endsAt)
      .slice(0, 5)
  }, [auctions, createCompetitionId])

  const toggleCreateSponsorInvite = (sponsorId: Id<"sponsors">) => {
    setCreateInvitedSponsorIdsOverride((current) => {
      const base = current ?? defaultCreateInvitedSponsorIds
      return base.includes(sponsorId)
        ? base.filter((id) => id !== sponsorId)
        : [...base, sponsorId]
    })
  }

  const onCreateAuction = async (event: SubmitEvent) => {
    event.preventDefault()
    if (createCompetitionId === null) {
      toast.error("Select a competition first.")
      return
    }
    const validation = validateAuctionFormInputs({
      framework: createFramework,
      startsAtInput: createStartsAtInput,
      endsAtInput: createEndsAtInput,
      startPriceEuros: createStartPriceEuros,
      invitedSponsorIds: createInvitedSponsorIds,
    })
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }

    setIsCreatingAuction(true)
    try {
      const auctionId = await createAuction({
        competitionId: createCompetitionId,
        framework: createFramework,
        ...validation.values,
      })
      toast.success("Auction draft created.")
      void onRefreshAuctionCompetitionData(auctionId, false)
      openEditAuction(auctionId)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create auction."
      toast.error(message)
    } finally {
      setIsCreatingAuction(false)
    }
  }

  return (
    <Page.Shell
      title="Create Sponsorship Auction"
      contentClassName={cn(PAGE_CONTENT_PADDING, "flex flex-col gap-4")}
    >
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => {
          backToList()
        }}
      >
        <ArrowLeft className="size-4" />
        Back to auctions
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Create Sponsorship Auction</CardTitle>
          <CardDescription>Create a draft for a competition.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuctionCreateForm
            isCreatingAuction={isCreatingAuction}
            createCompetitionId={createCompetitionId}
            createStartsAtInput={createStartsAtInput}
            setCreateStartsAtInput={setCreateStartsAtInput}
            createEndsAtInput={createEndsAtInput}
            setCreateEndsAtInput={setCreateEndsAtInput}
            createFramework={createFramework}
            setCreateFramework={setCreateFramework}
            isCreateFrameworkUnlocked={isCreateFrameworkUnlocked}
            setIsCreateFrameworkUnlocked={setIsCreateFrameworkUnlocked}
            createStartPriceEuros={createStartPriceEuros}
            setCreateStartPriceEuros={setCreateStartPriceEuros}
            createInvitedSponsorIds={createInvitedSponsorIds}
            activeSponsors={activeSponsors}
            unsponsoredCompetitionsByPhase={unsponsoredCompetitionsByPhase}
            sponsoredCompetitions={sponsoredCompetitions}
            competitionIdByString={competitionIdByString}
            selectedCompetition={selectedCompetition}
            busyCompetitionId={busyCompetitionId}
            onCreateAuction={onCreateAuction}
            toggleCreateSponsorInvite={toggleCreateSponsorInvite}
            setCreateCompetitionIdSelection={setCreateCompetitionIdSelection}
            onRevertCompetitionSponsorOverride={
              onRevertCompetitionSponsorOverride
            }
            sponsorById={sponsorById}
          />
          <Separator />
          <AuctionPanelHistory
            panelCompetitionId={createCompetitionId}
            previousClosedAuctions={previousClosedAuctionsForPanel}
            sponsorById={sponsorById}
            onViewClosedAuction={viewClosedAuction}
          />
        </CardContent>
      </Card>
    </Page.Shell>
  )
}
