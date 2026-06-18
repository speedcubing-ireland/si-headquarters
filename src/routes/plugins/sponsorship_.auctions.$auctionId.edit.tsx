import { createFileRoute } from "@tanstack/react-router"
import { AuctionEditRoute } from "@/plugins/sponsor/admin/routes/auction-edit-route"
import { requireSponsorshipAuctionId } from "@/lib/convex-ids"

export const Route = createFileRoute(
  "/plugins/sponsorship_/auctions/$auctionId/edit"
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { auctionId } = Route.useParams()
  return <AuctionEditRoute auctionId={requireSponsorshipAuctionId(auctionId)} />
}
