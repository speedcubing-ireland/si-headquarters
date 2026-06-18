import { AlertTriangle, Lock, LockOpen, RefreshCw, Trash2 } from "lucide-react"
import { STAT_CARD_EMPHASIS_CLASS } from "@/lib/theme-constants"
import { SponsorInlineLoading } from "@/plugins/sponsor/components/sponsor-ui"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { AuctionBidStatusSection } from "@/plugins/sponsor/admin/components/auction-bid-status-section"
import type { SponsorshipAdmin } from "@/plugins/sponsor/admin/use-sponsorship-admin"
import { formatDateTime } from "@/lib/format/irish-dates"
import {
  SPONSORSHIP_AUCTION_FRAMEWORKS,
  auctionFrameworkLabel,
} from "@/convex/plugins/sponsor/lib/types"
import {
  competitionPropertyStatusLabel,
  isSponsorshipFramework,
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

export function AuctionEditPanel({ admin }: { admin: SponsorshipAdmin }) {
  const { open, loading, actions } = admin
  const {
    selectedAuction,
    managerView,
    isSavingAuction,
    busyAuctionId,
    refreshingAuctionId,
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
    activeSponsors,
    hasPendingEditChanges,
    selectedOpenAuctionSponsorOutcomes,
    selectedAuctionCompetitionSummary,
    selectedAuctionCompetitionSummaryFetchedAt,
    isSelectedAuctionCompetitionSummaryReady,
    panelCompetition,
    panelCompetitionHasManualSponsorOverride,
    panelCompetitionManualSponsorName,
    busyCompetitionId,
  } = open
  const { isLoadingManagerView } = loading
  const {
    toggleEditSponsorInvite,
    onRevertCompetitionSponsorOverride,
    onSaveAuctionChanges,
    onRefreshAuctionCompetitionData,
    onStartAuction,
    onCloseAuction,
    onDeleteBeforeOpen,
  } = actions

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
      <div className="space-y-1 rounded-md border p-3 text-sm">
        <p className="font-medium">{selectedAuction.competitionName}</p>
        <p className="text-xs text-muted-foreground">
          {auctionFrameworkLabel(selectedAuction.framework)} ·{" "}
          {selectedAuction.competitionPhaseName}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={sponsorshipStateBadgeVariant(selectedAuction.state)}>
            {sponsorshipStateLabel(selectedAuction.state)}
          </Badge>
          <Badge variant="outline">
            Bid intents: {managerView.intentCount}
          </Badge>
          <Badge variant="outline">Bid events: {managerView.eventCount}</Badge>
        </div>
      </div>
      <div
        className={cn(
          "space-y-2 rounded-md border p-3 text-sm",
          !isSelectedAuctionCompetitionSummaryReady && STAT_CARD_EMPHASIS_CLASS
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Competition data status
          </p>
          <Badge
            variant={
              isSelectedAuctionCompetitionSummaryReady ? "default" : "secondary"
            }
          >
            {isSelectedAuctionCompetitionSummaryReady
              ? "Synced from WCA"
              : "Needs WCA sync"}
          </Badge>
        </div>
        {selectedAuctionCompetitionSummary ? (
          <>
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
          </>
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
      </div>
      {panelCompetition && panelCompetitionHasManualSponsorOverride ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Manual sponsor override active</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Override:{" "}
              {panelCompetition.manualSponsorId
                ? (panelCompetitionManualSponsorName ?? "Sponsor")
                : competitionPropertyStatusLabel(
                    panelCompetition.manualSponsorPropertyStatus ?? "none"
                  )}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyCompetitionId === panelCompetition.id}
              onClick={() =>
                void onRevertCompetitionSponsorOverride(panelCompetition.id)
              }
            >
              Revert override
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        className="space-y-3"
        onSubmit={(event) => void onSaveAuctionChanges(event)}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Auction type</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => {
                setIsEditFrameworkUnlocked((current) => !current)
              }}
            >
              {isEditFrameworkUnlocked ? (
                <LockOpen className="size-3.5" />
              ) : (
                <Lock className="size-3.5" />
              )}
              <span className="sr-only">
                {isEditFrameworkUnlocked
                  ? "Lock auction type"
                  : "Unlock auction type"}
              </span>
            </Button>
          </div>
          <Select
            value={editFramework}
            onValueChange={(value) => {
              if (!isSponsorshipFramework(value)) return
              setEditFramework(value)
            }}
            disabled={!isEditFrameworkUnlocked}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select auction type">
                {auctionFrameworkLabel(editFramework)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SPONSORSHIP_AUCTION_FRAMEWORKS.map((framework) => (
                <SelectItem key={framework} value={framework}>
                  {auctionFrameworkLabel(framework)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 @md/main:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Starts at</p>
            <Input
              type="datetime-local"
              value={editStartsAtInput}
              onChange={(event) => {
                setEditStartsAtInput(event.target.value)
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Ends at</p>
            <Input
              type="datetime-local"
              value={editEndsAtInput}
              onChange={(event) => {
                setEditEndsAtInput(event.target.value)
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Start price (EUR)</p>
            <Input
              type="number"
              min="1"
              step="0.01"
              value={editStartPriceEuros}
              onChange={(event) => {
                setEditStartPriceEuros(event.target.value)
              }}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Invited sponsors</p>
          <div className="grid gap-2 @md/main:grid-cols-2">
            {activeSponsors.map((sponsor) => (
              <div
                key={`edit-${sponsor.id}`}
                className="flex items-center gap-2 rounded border px-2 py-1.5"
              >
                <Checkbox
                  checked={editInvitedSponsorIds.includes(sponsor.id)}
                  onCheckedChange={() => {
                    toggleEditSponsorInvite(sponsor.id)
                  }}
                />
                <span className="text-sm">{sponsor.name}</span>
              </div>
            ))}
          </div>
        </div>

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

      <div className="space-y-3 rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Lifecycle actions</p>
          <p className="text-xs text-muted-foreground">
            Save pending edits before starting or closing an auction.
          </p>
        </div>
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
      </div>
      {selectedAuction.state !== "draft" &&
      selectedAuction.state !== "scheduled" ? (
        <>
          <Separator />
          <AuctionBidStatusSection
            intentCount={managerView.intentCount}
            eventCount={managerView.eventCount}
            outcomes={selectedOpenAuctionSponsorOutcomes}
            flatBreakdown
          />
        </>
      ) : null}
    </div>
  )
}
