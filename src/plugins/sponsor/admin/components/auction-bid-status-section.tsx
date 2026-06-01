import { Badge } from "@/components/ui/badge"
import {
  formatDateTime,
  formatEuroFromCents,
} from "@/plugins/sponsor/lib/sponsorship-ui"
import type {
  InvitedSponsorDisplay,
  SponsorBidOutcomeDisplay,
} from "@/plugins/sponsor/admin/types"

function AuctionSponsorBidBreakdown({
  outcomes,
  flat,
}: {
  outcomes: SponsorBidOutcomeDisplay[]
  flat?: boolean
}) {
  return (
    <div
      className={
        flat === true ? "space-y-1" : "space-y-1 rounded-md border p-2"
      }
    >
      <p className="text-xs text-muted-foreground">Sponsor bid breakdown</p>
      {outcomes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No sponsor outcomes available.
        </p>
      ) : (
        outcomes.map((outcome) => (
          <div
            key={`outcome-${outcome.sponsorId}`}
            className="flex items-center justify-between gap-3 rounded border px-2 py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {outcome.sponsorName}
              </p>
              <p className="text-xs text-muted-foreground">
                {outcome.isWinner
                  ? "Winner"
                  : outcome.validBidCount > 0
                    ? "Bidder"
                    : "No valid bid"}{" "}
                · {outcome.isInvited ? "Invited" : "Not invited"} · Valid bids:{" "}
                {outcome.validBidCount}/{outcome.totalBidCount}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium tabular-nums">
                {outcome.latestValidBidCents !== undefined
                  ? formatEuroFromCents(outcome.latestValidBidCents)
                  : "No valid bid"}
              </p>
              <p className="text-xs text-muted-foreground">
                {outcome.latestValidBidAt !== undefined
                  ? `${outcome.latestValidBidMode === "proxy" ? "Proxy" : "Manual"} · ${formatDateTime(outcome.latestValidBidAt)}`
                  : "No final valid bid"}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export function AuctionBidStatusSection({
  intentCount,
  eventCount,
  invitedSponsors,
  outcomes,
  flatBreakdown,
}: {
  intentCount: number
  eventCount: number
  invitedSponsors?: InvitedSponsorDisplay[]
  outcomes: SponsorBidOutcomeDisplay[]
  flatBreakdown?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Bid intents: {intentCount}</Badge>
        <Badge variant="outline">Bid events: {eventCount}</Badge>
        {invitedSponsors !== undefined ? (
          <Badge variant="outline">
            Invited sponsors: {invitedSponsors.length}
          </Badge>
        ) : null}
      </div>
      {invitedSponsors !== undefined ? (
        <div className="space-y-1 rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Invited sponsors</p>
          {invitedSponsors.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No invited sponsors on record.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {invitedSponsors.map((sponsor) => (
                <Badge
                  key={`invite-${sponsor.sponsorId}`}
                  variant="secondary"
                  className="text-[11px]"
                >
                  {sponsor.sponsorName}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ) : null}
      <AuctionSponsorBidBreakdown outcomes={outcomes} flat={flatBreakdown} />
    </div>
  )
}
