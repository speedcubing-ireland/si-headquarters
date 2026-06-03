import { StatCard } from "@/components/stat-card"
import type { SponsorshipAdmin } from "@/plugins/sponsor/admin/use-sponsorship-admin"

export function AdminStats({ stats }: { stats: SponsorshipAdmin["stats"] }) {
  const {
    openAuctions,
    closedAuctions,
    activeSponsors,
    competitions,
    needsSponsorCount,
  } = stats

  return (
    <div className="grid gap-3 @sm/main:grid-cols-3 @lg/main:grid-cols-5">
      <StatCard
        label="Open auctions"
        value={openAuctions.length}
        description="Draft, scheduled, or active"
        emphasis
      />
      <StatCard
        label="Closed auctions"
        value={closedAuctions.length}
        description="Completed outcomes"
      />
      <StatCard
        label="Active sponsors"
        value={activeSponsors.length}
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
