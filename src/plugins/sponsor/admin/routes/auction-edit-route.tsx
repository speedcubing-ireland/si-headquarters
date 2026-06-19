import { ArrowLeft } from "lucide-react"
import { useMemo, useState, type SubmitEvent } from "react"
import { toast } from "sonner"
import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SponsorInlineLoading } from "@/plugins/sponsor/components/sponsor-ui"
import { AbilityRouteGuard } from "@/features/auth"
import type { Id } from "@/convex/_generated/dataModel"
import { AuctionEditPanel } from "@/plugins/sponsor/admin/components/auction-edit-panel"
import { AuctionPanelHistory } from "@/plugins/sponsor/admin/components/auction-panel-history"
import { validateAuctionFormInputs } from "@/plugins/sponsor/admin/auction-editor-draft"
import { attachSponsorNames } from "@/plugins/sponsor/admin/sponsorship-admin-derivations"
import { useAuctionEditorDraft } from "@/plugins/sponsor/admin/hooks/use-auction-editor-draft"
import { useAuctionLifecycleActions } from "@/plugins/sponsor/admin/hooks/use-auction-lifecycle-actions"
import { useCompetitionOverrideRevert } from "@/plugins/sponsor/admin/hooks/use-competition-override-revert"
import { useSponsorshipEditorNavigation } from "@/plugins/sponsor/admin/use-sponsorship-admin-search"
import {
  useSponsors,
  useSponsorshipAuctionManagerView,
  useSponsorshipAuctionMutations,
  useSponsorshipAuctionsForManager,
  useSponsorshipCompetitionsForManager,
} from "@/plugins/sponsor/hooks/use-sponsorship"

export function AuctionEditRoute({
  auctionId,
}: {
  auctionId: Id<"sponsorshipAuctions">
}) {
  return (
    <AbilityRouteGuard
      action="access"
      subject="SponsorPortalAdmin"
      deniedMessage="Directors or Finance Team access is required."
      loadingMessage="Loading sponsorship admin…"
    >
      <AuctionEditContent auctionId={auctionId} />
    </AbilityRouteGuard>
  )
}

function AuctionEditContent({
  auctionId,
}: {
  auctionId: Id<"sponsorshipAuctions">
}) {
  const { backToList, viewClosedAuction } = useSponsorshipEditorNavigation()
  const { auctions, isLoading: isLoadingAuctions } =
    useSponsorshipAuctionsForManager()
  const { competitions } = useSponsorshipCompetitionsForManager()
  const { sponsors } = useSponsors()
  const { managerView, isLoading: isLoadingManagerView } =
    useSponsorshipAuctionManagerView(auctionId)
  const { updateAuction, refreshCompetitionSnapshot } =
    useSponsorshipAuctionMutations()
  const { draft, dirty, updateDraft } = useAuctionEditorDraft(managerView)
  const lifecycle = useAuctionLifecycleActions({ onDeleted: backToList })
  const { busyCompetitionId, onRevertCompetitionSponsorOverride } =
    useCompetitionOverrideRevert()

  const [isSavingAuction, setIsSavingAuction] = useState(false)

  const activeSponsors = useMemo(
    () => sponsors.filter((sponsor) => sponsor.active),
    [sponsors]
  )
  const sponsorById = useMemo(
    () => new Map(sponsors.map((sponsor) => [sponsor.id, sponsor])),
    [sponsors]
  )
  const resolveSponsorName = (sponsorId: Id<"sponsors">): string =>
    sponsorById.get(sponsorId)?.name ?? "Unknown sponsor"
  const competitionById = useMemo(
    () =>
      new Map(competitions.map((competition) => [competition.id, competition])),
    [competitions]
  )

  const selectedAuction = auctions.find((auction) => auction.id === auctionId)
  const panelCompetition =
    selectedAuction !== undefined
      ? (competitionById.get(selectedAuction.competitionId) ?? null)
      : null
  const previousClosedAuctionsForPanel = useMemo(() => {
    if (selectedAuction === undefined) return []
    return auctions
      .filter(
        (auction) =>
          auction.state === "closed" &&
          auction.competitionId === selectedAuction.competitionId &&
          auction.id !== selectedAuction.id
      )
      .sort((a, b) => b.endsAt - a.endsAt)
      .slice(0, 5)
  }, [auctions, selectedAuction])

  if (isLoadingManagerView || isLoadingAuctions) {
    return (
      <Page.Shell title="Edit Sponsorship Auction">
        <SponsorInlineLoading className="py-10" />
      </Page.Shell>
    )
  }

  if (managerView === null || selectedAuction === undefined || draft === null) {
    return (
      <Page.Shell
        title="Edit Sponsorship Auction"
        contentClassName={PAGE_CONTENT_PADDING_SCROLL}
      >
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={backToList}
        >
          <ArrowLeft className="size-4" />
          Back to auctions
        </Button>
        <p className="text-sm text-muted-foreground">
          This auction no longer exists.
        </p>
      </Page.Shell>
    )
  }

  const onSaveAuctionChanges = async (event: SubmitEvent) => {
    event.preventDefault()
    if (
      managerView.auction.state === "active" ||
      managerView.auction.state === "closed"
    ) {
      toast.error("Only draft or scheduled auctions can be edited.")
      return
    }
    const validation = validateAuctionFormInputs(draft)
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }
    setIsSavingAuction(true)
    try {
      await updateAuction({
        auctionId,
        framework: draft.framework,
        ...validation.values,
      })
      await refreshCompetitionSnapshot(auctionId).catch(() => undefined)
      toast.success("Auction updated.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update auction."
      toast.error(message)
    } finally {
      setIsSavingAuction(false)
    }
  }

  return (
    <Page.Shell
      title="Edit Sponsorship Auction"
      contentClassName={PAGE_CONTENT_PADDING_SCROLL}
    >
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={backToList}
        >
          <ArrowLeft className="size-4" />
          Back to auctions
        </Button>
        <AuctionEditPanel
          selectedAuction={selectedAuction}
          managerView={managerView}
          isSavingAuction={isSavingAuction}
          busyAuctionId={lifecycle.busyAuctionId}
          refreshingAuctionId={lifecycle.refreshingAuctionId}
          draft={draft}
          onDraftChange={updateDraft}
          activeSponsors={activeSponsors}
          hasPendingEditChanges={dirty}
          selectedOpenAuctionSponsorOutcomes={attachSponsorNames(
            managerView.sponsorOutcomes,
            resolveSponsorName
          )}
          selectedAuctionCompetitionSummary={managerView.competitionSummary}
          selectedAuctionCompetitionSummaryFetchedAt={
            managerView.competitionSummaryFetchedAt
          }
          isSelectedAuctionCompetitionSummaryReady={
            managerView.competitionSummarySource === "wca"
          }
          panelCompetition={panelCompetition}
          panelCompetitionManualSponsorName={
            panelCompetition?.manualSponsorId
              ? sponsorById.get(panelCompetition.manualSponsorId)?.name
              : undefined
          }
          busyCompetitionId={busyCompetitionId}
          isLoadingManagerView={isLoadingManagerView}
          onRevertCompetitionSponsorOverride={
            onRevertCompetitionSponsorOverride
          }
          onSaveAuctionChanges={onSaveAuctionChanges}
          onRefreshAuctionCompetitionData={(id) =>
            lifecycle.onRefreshAuctionCompetitionData(id)
          }
          onStartAuction={(id) => lifecycle.onStartAuction(id, dirty)}
          onCloseAuction={(id) => lifecycle.onCloseAuction(id, dirty)}
          onDeleteBeforeOpen={(id) => lifecycle.onDeleteBeforeOpen(id)}
        />
        <Card>
          <CardHeader>
            <CardTitle>Previous closed auctions</CardTitle>
            <CardDescription>
              Other closed auctions for this competition.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuctionPanelHistory
              panelCompetitionId={panelCompetition?.id ?? null}
              previousClosedAuctions={previousClosedAuctionsForPanel}
              sponsorById={sponsorById}
              onViewClosedAuction={viewClosedAuction}
            />
          </CardContent>
        </Card>
      </div>
    </Page.Shell>
  )
}
