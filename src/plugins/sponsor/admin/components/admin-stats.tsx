import { StatCard } from "@/components/stat-card"
import {
  useSponsors,
  useSponsorshipAuctionsForManager,
  useSponsorshipCompetitionsForManager,
} from "@/plugins/sponsor/hooks/use-sponsorship"

export function AdminStats() {
  const { auctions } = useSponsorshipAuctionsForManager()
  const { sponsors } = useSponsors()
  const { competitions } = useSponsorshipCompetitionsForManager()

  const openAuctions = auctions.filter(
    (auction) => auction.state !== "closed"
  ).length
  const closedAuctions = auctions.filter(
    (auction) => auction.state === "closed"
  ).length
  const activeSponsors = sponsors.filter((sponsor) => sponsor.active).length
  const needsSponsorCount = competitions.filter(
    (competition) => competition.sponsorPropertyStatus !== "sponsor"
  ).length

  return (
    <div className="grid gap-3 @sm/main:grid-cols-3 @lg/main:grid-cols-5">
      <StatCard
        label="Open auctions"
        value={openAuctions}
        description="Draft, scheduled, or active"
        emphasis
      />
      <StatCard
        label="Closed auctions"
        value={closedAuctions}
        description="Completed outcomes"
      />
      <StatCard
        label="Active sponsors"
        value={activeSponsors}
        description="Can be invited"
      />
      <StatCard
        label="Needs sponsor"
        value={needsSponsorCount}
        description="Available competitions"
        emphasis={needsSponsorCount > 0}
      />
      <StatCard
        label="Competition load"
        value={competitions.length}
        description="Synced competitions"
      />
    </div>
  )
}
