import { createFileRoute } from "@tanstack/react-router"
import { AuctionCreateRoute } from "@/plugins/sponsor/admin/routes/auction-create-route"

export const Route = createFileRoute("/plugins/sponsorship_/auctions/new")({
  component: AuctionCreateRoute,
})
