import { SponsorFrameworkGuideGrid } from "@/plugins/sponsor/components/sponsor-framework-guide-card"
import { SPONSOR_AUCTIONS_OVERVIEW } from "@/plugins/sponsor/lib/sponsor-guide"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function AuctionTypesTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Auction Types</CardTitle>
        <CardDescription>
          {SPONSOR_AUCTIONS_OVERVIEW.formatsIntro} Sponsors see the same
          guidance in the sponsor portal information page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SponsorFrameworkGuideGrid />
      </CardContent>
    </Card>
  )
}
