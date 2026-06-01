import { createFileRoute } from "@tanstack/react-router"
import { PortalAuctionDetailPage } from "@/plugins/sponsor/pages/portal-auction-detail"
import { requireSponsorshipAuctionId } from "@/lib/convex-ids"

export const Route = createFileRoute("/sponsor/auctions/$auctionId")({
  component: RouteComponent,
})

function RouteComponent() {
  const { auctionId } = Route.useParams()
  return (
    <PortalAuctionDetailPage
      auctionId={requireSponsorshipAuctionId(auctionId)}
    />
  )
}
