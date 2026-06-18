import { useNavigate } from "@tanstack/react-router"
import type { AdminSponsorshipTab } from "@/plugins/sponsor/admin/types"

/** Navigates the sponsorship admin tab via the `?tab=` search param. */
export function useSponsorshipTabNavigation() {
  const navigate = useNavigate({ from: "/plugins/sponsorship" })
  return (tab: AdminSponsorshipTab) => {
    void navigate({
      search: (previous) => ({ ...previous, tab }),
    })
  }
}
