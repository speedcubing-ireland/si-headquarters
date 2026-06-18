import { useState } from "react"
import { Spinner } from "@/components/ui/spinner"
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
import { formatDateTime } from "@/lib/format/irish-dates"
import { auctionFrameworkLabel } from "@/convex/plugins/sponsor/lib/types"
import {
  displayAuctionPriceCents,
  formatEuroFromCents,
  sponsorshipStateBadgeVariant,
  sponsorshipStateLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui"
import {
  useSponsors,
  useSponsorshipAuctionManagerView,
  useSponsorshipAuctionsForManager,
} from "@/plugins/sponsor/hooks/use-sponsorship"
import {
  attachSponsorNames,
  filterAuctionsBySearch,
} from "@/plugins/sponsor/admin/sponsorship-admin-derivations"
import {
  useSponsorshipAdminNavigation,
  useSponsorshipAdminSearch,
} from "@/plugins/sponsor/admin/use-sponsorship-admin-search"

export function ClosedAuctionsTab() {
  const [searchQuery, setSearchQuery] = useState("")
  const { closedAuctionId } = useSponsorshipAdminSearch()
  const { setClosedAuctionId } = useSponsorshipAdminNavigation()

  const { auctions, isLoading: isLoadingAuctions } =
    useSponsorshipAuctionsForManager()
  const { sponsors } = useSponsors()
  const { managerView, isLoading: isLoadingManagerView } =
    useSponsorshipAuctionManagerView(closedAuctionId ?? null)

  const sponsorNameById = new Map(
    sponsors.map((sponsor) => [sponsor.id, sponsor.name])
  )
  const resolveSponsorName = (sponsorId: (typeof sponsors)[number]["id"]) =>
    sponsorNameById.get(sponsorId) ?? "Unknown sponsor"

  const closedAuctions = auctions.filter(
    (auction) => auction.state === "closed"
  )
  const filteredClosedAuctions = filterAuctionsBySearch(
    closedAuctions,
    searchQuery
  )
  const selectedClosedAuction =
    closedAuctionId === undefined
      ? null
      : (closedAuctions.find((auction) => auction.id === closedAuctionId) ??
        null)

  const winnerName = selectedClosedAuction?.winnerSponsorId
    ? resolveSponsorName(selectedClosedAuction.winnerSponsorId)
    : "No winner"
  const invitedSponsors =
    managerView?.inviteSponsorIds.map((sponsorId) => ({
      sponsorId,
      sponsorName: resolveSponsorName(sponsorId),
    })) ?? []
  const sponsorOutcomes = attachSponsorNames(
    managerView?.sponsorOutcomes ?? [],
    resolveSponsorName
  )

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
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
              }}
              className="max-w-sm"
            />
            <AuctionTable
              rows={filteredClosedAuctions}
              emptyText="No closed auctions."
              selectedId={closedAuctionId ?? null}
              actionLabel="View"
              onSelect={(auctionId) => {
                setClosedAuctionId(auctionId)
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
                    {auctionFrameworkLabel(selectedClosedAuction.framework)} ·{" "}
                    {selectedClosedAuction.competitionPhaseName}
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
                    <span className="font-medium">{winnerName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Winning bid</span>
                    <span className="font-medium tabular-nums">
                      {formatEuroFromCents(
                        displayAuctionPriceCents(selectedClosedAuction)
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
                {isLoadingManagerView ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner />
                  </div>
                ) : managerView ? (
                  <AuctionBidStatusSection
                    intentCount={managerView.intentCount}
                    eventCount={managerView.eventCount}
                    invitedSponsors={invitedSponsors}
                    outcomes={sponsorOutcomes}
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
