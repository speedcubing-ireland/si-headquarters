import { useNavigate } from "@tanstack/react-router"
import type { AdminTab } from "@/features/admin/types"

export function useAdminTabNavigation(from: "/admin/") {
  const navigate = useNavigate({ from })

  return (tab: AdminTab) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        tab,
      }),
    })
  }
}
