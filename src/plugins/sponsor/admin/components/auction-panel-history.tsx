import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Id } from "@/convex/_generated/dataModel"
import type {
  ManagerAuction,
  ManagerSponsor,
} from "@/plugins/sponsor/admin/manager-types"
import { formatDateTime } from "@/lib/format/irish-dates"
import { auctionFrameworkLabel } from "@/convex/plugins/sponsor/lib/types"
import { formatEuroFromCents } from "@/plugins/sponsor/lib/sponsorship-ui"

export function AuctionPanelHistory({
  panelCompetitionId,
  previousClosedAuctions,
  sponsorById,
  onViewClosedAuction,
}: {
  panelCompetitionId: Id<"competitions"> | null
  previousClosedAuctions: ManagerAuction[]
  sponsorById: Map<Id<"sponsors">, ManagerSponsor>
  onViewClosedAuction: (auctionId: Id<"sponsorshipAuctions">) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Previous closed auctions for this competition
        </p>
        {panelCompetitionId ? (
          <Badge variant="outline">{previousClosedAuctions.length}</Badge>
        ) : null}
      </div>
      {panelCompetitionId === null ? (
        <p className="text-sm text-muted-foreground">
          Select a competition to view historical outcomes.
        </p>
      ) : previousClosedAuctions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No previous closed auctions for this competition.
        </p>
      ) : (
        <div className="space-y-2">
          {previousClosedAuctions.map((auction) => {
            const winningBidCents =
              auction.settlementAmountCents ??
              auction.currentPriceCents ??
              auction.startPriceCents
            const winnerName = auction.winnerSponsorId
              ? (sponsorById.get(auction.winnerSponsorId)?.name ??
                "Unknown sponsor")
              : "No winner"
            return (
              <div
                key={`history-${auction.id}`}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {formatDateTime(auction.endsAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {auctionFrameworkLabel(auction.framework)} · {winnerName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Winning bid: {formatEuroFromCents(winningBidCents)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onViewClosedAuction(auction.id)
                  }}
                >
                  View
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
