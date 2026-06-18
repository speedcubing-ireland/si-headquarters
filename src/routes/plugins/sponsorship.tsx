import { createFileRoute } from "@tanstack/react-router"
import { SponsorshipAdminPage } from "@/plugins/sponsor/pages/admin-sponsorship"
import {
  isAdminSponsorshipTab,
  type AdminSponsorshipTab,
} from "@/plugins/sponsor/admin/types"

interface SponsorshipSearch {
  tab?: AdminSponsorshipTab
}

export const Route = createFileRoute("/plugins/sponsorship")({
  validateSearch: (search: { tab?: string }): SponsorshipSearch => ({
    tab:
      typeof search.tab === "string" && isAdminSponsorshipTab(search.tab)
        ? search.tab
        : undefined,
  }),
  component: SponsorshipAdminRoute,
})

function SponsorshipAdminRoute() {
  const { tab } = Route.useSearch()
  return <SponsorshipAdminPage activeTab={tab ?? "open"} />
}
