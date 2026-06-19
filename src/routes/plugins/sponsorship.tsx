import { createFileRoute } from "@tanstack/react-router"
import type { Id } from "@/convex/_generated/dataModel"
import { parseSponsorshipAuctionId } from "@/lib/convex-ids"
import { SponsorshipAdminPage } from "@/plugins/sponsor/pages/admin-sponsorship"
import {
  isAdminSponsorshipTab,
  type AdminSponsorshipTab,
} from "@/plugins/sponsor/admin/types"

interface SponsorshipSearch {
  tab?: AdminSponsorshipTab
  closedAuctionId?: Id<"sponsorshipAuctions">
}

export const Route = createFileRoute("/plugins/sponsorship")({
  validateSearch: (search: {
    tab?: string
    closedAuctionId?: string
  }): SponsorshipSearch => ({
    tab:
      typeof search.tab === "string" && isAdminSponsorshipTab(search.tab)
        ? search.tab
        : undefined,
    closedAuctionId:
      typeof search.closedAuctionId === "string"
        ? (parseSponsorshipAuctionId(search.closedAuctionId) ?? undefined)
        : undefined,
  }),
  component: SponsorshipAdminRoute,
})

function SponsorshipAdminRoute() {
  const { tab } = Route.useSearch()
  return <SponsorshipAdminPage activeTab={tab ?? "open"} />
}
