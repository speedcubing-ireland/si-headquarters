import { SponsorInlineLoading } from "@/plugins/sponsor/components/sponsor-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Id } from "@/convex/_generated/dataModel"
import { formatDateTime } from "@/lib/format/irish-dates"
import {
  auctionFrameworkLabel,
  type SponsorshipAuctionFramework,
} from "@/convex/plugins/sponsor/lib/types"
import {
  formatAuctionTablePrice,
  formatEuroFromCents,
  sponsorshipStateBadgeVariant,
  sponsorshipStateLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui"

export interface ManagerAuctionRow {
  id: Id<"sponsorshipAuctions">
  competitionName: string
  competitionPhaseName: string
  competitionCompStart?: string
  framework: SponsorshipAuctionFramework
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
    return <SponsorInlineLoading className="py-10" />
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Competition</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Framework</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Price</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((auction) => {
            const isSelected = selectedId === auction.id
            const { amountCents, showWinningBidLabel } =
              formatAuctionTablePrice(auction)

            return (
              <TableRow
                key={auction.id}
                data-state={isSelected ? "selected" : undefined}
              >
                <TableCell className="align-top whitespace-normal">
                  <div className="space-y-0.5">
                    <p className="font-medium">{auction.competitionName}</p>
                    {auction.competitionCompStart !== undefined &&
                    auction.competitionCompStart.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {auction.competitionCompStart}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{auction.competitionPhaseName}</TableCell>
                <TableCell>
                  <Badge variant={sponsorshipStateBadgeVariant(auction.state)}>
                    {sponsorshipStateLabel(auction.state)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {auctionFrameworkLabel(auction.framework)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(auction.startsAt)}
                  <br />
                  {formatDateTime(auction.endsAt)}
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="tabular-nums">
                      {formatEuroFromCents(amountCents)}
                    </p>
                    {showWinningBidLabel ? (
                      <p className="text-xs text-muted-foreground">
                        Winning bid
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onSelect(auction.id)
                    }}
                  >
                    {actionLabel}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
