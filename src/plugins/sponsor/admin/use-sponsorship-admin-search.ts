import { useNavigate, useSearch } from "@tanstack/react-router"
import type { Id } from "@/convex/_generated/dataModel"
import type { AdminSponsorshipTab } from "@/plugins/sponsor/admin/types"

export function useSponsorshipAdminSearch() {
  return useSearch({ from: "/plugins/sponsorship" })
}

export function useSponsorshipAdminNavigation() {
  const navigate = useNavigate({ from: "/plugins/sponsorship" })
  return {
    setTab: (tab: AdminSponsorshipTab) => {
      void navigate({ search: (previous) => ({ ...previous, tab }) })
    },
    setClosedAuctionId: (closedAuctionId: Id<"sponsorshipAuctions"> | null) => {
      void navigate({
        search: (previous) => ({
          ...previous,
          closedAuctionId: closedAuctionId ?? undefined,
        }),
      })
    },
    viewClosedAuction: (closedAuctionId: Id<"sponsorshipAuctions">) => {
      void navigate({
        search: (previous) => ({ ...previous, tab: "closed", closedAuctionId }),
      })
    },
  }
}
