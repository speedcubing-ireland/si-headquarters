import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Open Auctions</CardDescription>
          <CardTitle className="text-2xl">{openAuctions.length}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Closed Auctions</CardDescription>
          <CardTitle className="text-2xl">{closedAuctions.length}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Active Sponsors</CardDescription>
          <CardTitle className="text-2xl">{activeSponsors.length}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Needs Sponsor</CardDescription>
          <CardTitle className="text-2xl">{needsSponsorCount}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Competition Load</CardDescription>
          <CardTitle className="text-2xl">{competitions.length}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}
