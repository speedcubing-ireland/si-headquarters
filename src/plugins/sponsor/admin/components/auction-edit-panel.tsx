import { RefreshCw, Trash2 } from "lucide-react"
import { STAT_CARD_EMPHASIS_CLASS } from "@/lib/theme-constants"
import { SponsorInlineLoading } from "@/plugins/sponsor/components/sponsor-ui"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { SubmitEvent } from "react"
import { AuctionBidStatusSection } from "@/plugins/sponsor/admin/components/auction-bid-status-section"
import { AuctionFormFields } from "@/plugins/sponsor/admin/components/auction-form-fields"
import { CompetitionOverrideAlert } from "@/plugins/sponsor/admin/components/competition-override-alert"
import type { Id } from "@/convex/_generated/dataModel"
import type { SponsorBidOutcomeDisplay } from "@/plugins/sponsor/admin/types"
import type {
  ManagerAuction,
  ManagerCompetition,
  ManagerSponsor,
  ManagerView,
} from "@/plugins/sponsor/admin/manager-types"
import type { AuctionEditorDraft } from "@/plugins/sponsor/admin/auction-editor-draft"
import { formatDateTime } from "@/lib/format/dates"
import { auctionFrameworkLabel } from "@/convex/plugins/sponsor/lib/types"
import {
  sponsorshipStateBadgeVariant,
  sponsorshipStateLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui"

function formatCompetitionSummaryDateRange(summary: {
  startDate: string
  endDate: string
}): string {
  const start = summary.startDate.trim() || "TBC"
  const end = summary.endDate.trim() || "TBC"
  return start === end ? start : `${start} - ${end}`
}

export function AuctionEditPanel({
  selectedAuction,
  managerView,
  isSavingAuction,
  busyAuctionId,
  refreshingAuctionId,
  draft,
  onDraftChange,
  activeSponsors,
  hasPendingEditChanges,
  selectedOpenAuctionSponsorOutcomes,
  selectedAuctionCompetitionSummary,
  selectedAuctionCompetitionSummaryFetchedAt,
  isSelectedAuctionCompetitionSummaryReady,
  panelCompetition,
  panelCompetitionManualSponsorName,
  busyCompetitionId,
  isLoadingManagerView,
  onRevertCompetitionSponsorOverride,
  onSaveAuctionChanges,
  onRefreshAuctionCompetitionData,
  onStartAuction,
  onCloseAuction,
  onDeleteBeforeOpen,
}: {
  selectedAuction: ManagerAuction | undefined
  managerView: ManagerView | null
  isSavingAuction: boolean
  busyAuctionId: Id<"sponsorshipAuctions"> | null
  refreshingAuctionId: Id<"sponsorshipAuctions"> | null
  draft: AuctionEditorDraft
  onDraftChange: (patch: Partial<AuctionEditorDraft>) => void
  activeSponsors: ManagerSponsor[]
  hasPendingEditChanges: boolean
  selectedOpenAuctionSponsorOutcomes: SponsorBidOutcomeDisplay[]
  selectedAuctionCompetitionSummary: ManagerView["competitionSummary"] | null
  selectedAuctionCompetitionSummaryFetchedAt: ManagerView["competitionSummaryFetchedAt"]
  isSelectedAuctionCompetitionSummaryReady: boolean
  panelCompetition: ManagerCompetition | null
  panelCompetitionManualSponsorName: string | undefined
  busyCompetitionId: Id<"competitions"> | null
  isLoadingManagerView: boolean
  onRevertCompetitionSponsorOverride: (
    competitionId: Id<"competitions">
  ) => Promise<void>
  onSaveAuctionChanges: (event: SubmitEvent) => Promise<void>
  onRefreshAuctionCompetitionData: (
    auctionId: Id<"sponsorshipAuctions">
  ) => Promise<{ status: string; message: string }>
  onStartAuction: (auctionId: Id<"sponsorshipAuctions">) => Promise<void>
  onCloseAuction: (auctionId: Id<"sponsorshipAuctions">) => Promise<void>
  onDeleteBeforeOpen: (auctionId: Id<"sponsorshipAuctions">) => Promise<void>
}) {
  if (!selectedAuction) {
    return (
      <p className="text-sm text-muted-foreground">
        Select an auction from the table.
      </p>
    )
  }

  if (isLoadingManagerView || managerView === null) {
    return <SponsorInlineLoading className="py-6" />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{selectedAuction.competitionName}</CardTitle>
          <CardDescription>
            {auctionFrameworkLabel(selectedAuction.framework)} ·{" "}
            {selectedAuction.competitionPhaseName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={sponsorshipStateBadgeVariant(selectedAuction.state)}
            >
              {sponsorshipStateLabel(selectedAuction.state)}
            </Badge>
            <Badge variant="outline">
              Bid intents: {managerView.intentCount}
            </Badge>
            <Badge variant="outline">
              Bid events: {managerView.eventCount}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          !isSelectedAuctionCompetitionSummaryReady && STAT_CARD_EMPHASIS_CLASS
        )}
      >
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>Competition data</CardTitle>
              <CardDescription>
                WCA snapshot used for sponsor-facing auction details.
              </CardDescription>
            </div>
            <Badge
              variant={
                isSelectedAuctionCompetitionSummaryReady
                  ? "default"
                  : "secondary"
              }
            >
              {isSelectedAuctionCompetitionSummaryReady
                ? "Synced from WCA"
                : "Needs WCA sync"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedAuctionCompetitionSummary ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {selectedAuctionCompetitionSummary.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Dates:{" "}
                {formatCompetitionSummaryDateRange(
                  selectedAuctionCompetitionSummary
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Competitor limit:{" "}
                {selectedAuctionCompetitionSummary.competitorLimit !== undefined
                  ? String(selectedAuctionCompetitionSummary.competitorLimit)
                  : "Not set"}
              </p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {selectedAuctionCompetitionSummaryFetchedAt !== undefined
              ? `Last synced: ${formatDateTime(selectedAuctionCompetitionSummaryFetchedAt)}`
              : "Last synced: not yet"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshingAuctionId === selectedAuction.id}
            onClick={() =>
              void onRefreshAuctionCompetitionData(selectedAuction.id)
            }
          >
            {refreshingAuctionId === selectedAuction.id ? (
              <Spinner />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh competition data
          </Button>
        </CardContent>
      </Card>

      {panelCompetition ? (
        <CompetitionOverrideAlert
          competition={panelCompetition}
          manualSponsorName={panelCompetitionManualSponsorName}
          busy={busyCompetitionId === panelCompetition.id}
          onRevert={(competitionId) =>
            void onRevertCompetitionSponsorOverride(competitionId)
          }
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Auction settings</CardTitle>
          <CardDescription>
            Update schedule, pricing, and invited sponsors before bidding opens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => void onSaveAuctionChanges(event)}
          >
            <AuctionFormFields
              draft={draft}
              onDraftChange={onDraftChange}
              activeSponsors={activeSponsors}
            />

            <Button
              type="submit"
              variant="outline"
              disabled={
                isSavingAuction ||
                selectedAuction.state === "active" ||
                selectedAuction.state === "closed"
              }
            >
              {isSavingAuction ? <Spinner /> : "Save changes"}
            </Button>
            {hasPendingEditChanges ? (
              <p className="text-xs text-muted-foreground">
                You have unsaved changes.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle actions</CardTitle>
          <CardDescription>
            Save pending edits before starting or closing an auction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {selectedAuction.state === "draft" ||
            selectedAuction.state === "scheduled" ? (
              <Button
                size="sm"
                disabled={
                  busyAuctionId === selectedAuction.id ||
                  hasPendingEditChanges ||
                  refreshingAuctionId === selectedAuction.id
                }
                onClick={() => void onStartAuction(selectedAuction.id)}
              >
                Start auction
              </Button>
            ) : null}
            {selectedAuction.state !== "closed" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  busyAuctionId === selectedAuction.id || hasPendingEditChanges
                }
                onClick={() => void onCloseAuction(selectedAuction.id)}
              >
                Close auction
              </Button>
            ) : null}
          </div>
          {selectedAuction.state === "draft" ||
          selectedAuction.state === "scheduled" ? (
            <div className="border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Delete draft auction
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Only available before bidding opens.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busyAuctionId === selectedAuction.id}
                  onClick={() => void onDeleteBeforeOpen(selectedAuction.id)}
                >
                  <Trash2 className="size-4" />
                  Delete before open
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {selectedAuction.state !== "draft" &&
      selectedAuction.state !== "scheduled" ? (
        <Card>
          <CardHeader>
            <CardTitle>Bid status</CardTitle>
            <CardDescription>
              Sponsor outcomes for this auction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuctionBidStatusSection
              intentCount={managerView.intentCount}
              eventCount={managerView.eventCount}
              outcomes={selectedOpenAuctionSponsorOutcomes}
              flatBreakdown
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
