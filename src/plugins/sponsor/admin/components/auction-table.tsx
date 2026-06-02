import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Id } from "@/convex/_generated/dataModel"
import {
  formatAuctionTablePrice,
  formatDateTime,
  formatEuroFromCents,
  sponsorshipFrameworkLabel,
  sponsorshipStateBadgeVariant,
  sponsorshipStateLabel,
  type SponsorshipFramework,
} from "@/plugins/sponsor/lib/sponsorship-ui"

export interface ManagerAuctionRow {
  id: Id<"sponsorshipAuctions">
  competitionName: string
  competitionPhaseName: string
  competitionCompStart?: string
  framework: SponsorshipFramework
  state: "draft" | "scheduled" | "active" | "closed"
  startsAt: number
  endsAt: number
  startPriceCents: number
  currentPriceCents?: number
  settlementAmountCents?: number
}

export function AuctionTable({
  rows,
  emptyText,
  selectedId,
  actionLabel,
  onSelect,
  isLoading,
}: {
  rows: ManagerAuctionRow[]
  emptyText: string
  selectedId: Id<"sponsorshipAuctions"> | null
  actionLabel: string
  onSelect: (auctionId: Id<"sponsorshipAuctions">) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Competition</th>
            <th className="px-3 py-2 text-left font-medium">Phase</th>
            <th className="px-3 py-2 text-left font-medium">State</th>
            <th className="px-3 py-2 text-left font-medium">Framework</th>
            <th className="px-3 py-2 text-left font-medium">Window</th>
            <th className="px-3 py-2 text-left font-medium">Price</th>
            <th className="px-3 py-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((auction) => {
            const isSelected = selectedId === auction.id
            const { amountCents, showWinningBidLabel } =
              formatAuctionTablePrice(auction)

            return (
              <tr key={auction.id} className={isSelected ? "bg-primary/5" : ""}>
                <td className="px-3 py-2 align-top">
                  <div className="space-y-0.5">
                    <p className="font-medium">{auction.competitionName}</p>
                    {auction.competitionCompStart !== undefined &&
                    auction.competitionCompStart.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {auction.competitionCompStart}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">{auction.competitionPhaseName}</td>
                <td className="px-3 py-2">
                  <Badge variant={sponsorshipStateBadgeVariant(auction.state)}>
                    {sponsorshipStateLabel(auction.state)}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {sponsorshipFrameworkLabel(auction.framework)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatDateTime(auction.startsAt)}
                  <br />
                  {formatDateTime(auction.endsAt)}
                </td>
                <td className="px-3 py-2">
                  <div className="space-y-0.5">
                    <p>{formatEuroFromCents(amountCents)}</p>
                    {showWinningBidLabel ? (
                      <p className="text-xs text-muted-foreground">
                        Winning bid
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onSelect(auction.id)
                    }}
                  >
                    {actionLabel}
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
