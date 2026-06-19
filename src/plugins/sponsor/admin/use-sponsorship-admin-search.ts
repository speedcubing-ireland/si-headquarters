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
  }
}

export function useSponsorshipEditorNavigation() {
  const navigate = useNavigate()
  return {
    openCreateAuction: () => {
      void navigate({ to: "/plugins/sponsorship/auctions/new" })
    },
    openEditAuction: (auctionId: Id<"sponsorshipAuctions">) => {
      void navigate({
        to: "/plugins/sponsorship/auctions/$auctionId/edit",
        params: { auctionId },
      })
    },
    backToList: () => {
      void navigate({ to: "/plugins/sponsorship", search: { tab: "open" } })
    },
    viewClosedAuction: (closedAuctionId: Id<"sponsorshipAuctions">) => {
      void navigate({
        to: "/plugins/sponsorship",
        search: { tab: "closed", closedAuctionId },
      })
    },
  }
}
