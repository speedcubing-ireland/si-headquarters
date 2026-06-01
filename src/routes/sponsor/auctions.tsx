import { createFileRoute } from "@tanstack/react-router"
import { PortalAuctionsPage } from "@/plugins/sponsor/pages/portal-auctions"

export const Route = createFileRoute("/sponsor/auctions")({
  component: PortalAuctionsPage,
})
