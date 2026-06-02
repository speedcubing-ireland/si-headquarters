import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TabsContent } from "@/components/ui/tabs"
import { AuctionBidStatusSection } from "@/plugins/sponsor/admin/components/auction-bid-status-section"
import { AuctionTable } from "@/plugins/sponsor/admin/components/auction-table"
import type { SponsorshipAdmin } from "@/plugins/sponsor/admin/use-sponsorship-admin"
import {
  formatDateTime,
  formatEuroFromCents,
  sponsorshipFrameworkLabel,
  sponsorshipStateBadgeVariant,
  sponsorshipStateLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui"

export function ClosedAuctionsTab({ admin }: { admin: SponsorshipAdmin }) {
  const { closed, loading } = admin
  const {
    closedSearchQuery,
    setClosedSearchQuery,
    filteredClosedAuctions,
    selectedClosedAuctionId,
    setSelectedClosedAuctionId,
    selectedClosedAuction,
    selectedClosedAuctionWinnerName,
    selectedClosedAuctionWinningBidCents,
    selectedClosedAuctionInvitedSponsors,
    selectedClosedAuctionSponsorOutcomes,
    closedAuctionManagerView,
  } = closed
  const { isLoadingAuctions, isLoadingClosedAuctionManagerView } = loading

  return (
    <TabsContent value="closed" className="space-y-4">
      <div className="grid gap-4 @xl/main:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Closed Auctions</CardTitle>
            <CardDescription>
              Historical auctions and winning bids.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search competitions or phases"
              value={closedSearchQuery}
              onChange={(event) => {
                setClosedSearchQuery(event.target.value)
              }}
              className="max-w-sm"
            />
            <AuctionTable
              rows={filteredClosedAuctions}
              emptyText="No closed auctions."
              selectedId={selectedClosedAuctionId}
              actionLabel="View"
              onSelect={(auctionId) => {
                setSelectedClosedAuctionId(auctionId)
              }}
              isLoading={isLoadingAuctions}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auction Outcome</CardTitle>
            <CardDescription>
              Review winner and final amount for previous auctions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedClosedAuction === null ? (
              <p className="text-sm text-muted-foreground">
                Select a closed auction from the table.
              </p>
            ) : (
              <>
                <div className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {selectedClosedAuction.competitionName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sponsorshipFrameworkLabel(selectedClosedAuction.framework)}{" "}
                    · {selectedClosedAuction.competitionPhaseName}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant={sponsorshipStateBadgeVariant(
                        selectedClosedAuction.state
                      )}
                    >
                      {sponsorshipStateLabel(selectedClosedAuction.state)}
                    </Badge>
                    <Badge variant="outline">
                      Closed {formatDateTime(selectedClosedAuction.endsAt)}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2 rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Winner</span>
                    <span className="font-medium">
                      {selectedClosedAuctionWinnerName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Winning bid</span>
                    <span className="font-medium tabular-nums">
                      {formatEuroFromCents(
                        selectedClosedAuctionWinningBidCents ??
                          selectedClosedAuction.startPriceCents
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Start price</span>
                    <span className="font-medium tabular-nums">
                      {formatEuroFromCents(
                        selectedClosedAuction.startPriceCents
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-medium">
                      {formatDateTime(selectedClosedAuction.startsAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Closed</span>
                    <span className="font-medium">
                      {formatDateTime(selectedClosedAuction.endsAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Last updated</span>
                    <span className="font-medium">
                      {formatDateTime(selectedClosedAuction.updatedAt)}
                    </span>
                  </div>
                </div>
                {isLoadingClosedAuctionManagerView ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : closedAuctionManagerView ? (
                  <AuctionBidStatusSection
                    intentCount={closedAuctionManagerView.intentCount}
                    eventCount={closedAuctionManagerView.eventCount}
                    invitedSponsors={selectedClosedAuctionInvitedSponsors}
                    outcomes={selectedClosedAuctionSponsorOutcomes}
                  />
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  )
}
