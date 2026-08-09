import { useMemo } from "react"
import { useCan } from "@/features/auth/ability"
import type { AdminTab } from "@/features/admin/types"

export function useAdminAccess() {
  const userManagement = useCan("manage", "UserManagement")
  const director = useCan("manage", "all")

  const isLoading = userManagement.isLoading || director.isLoading
  const allowed = userManagement.allowed || director.allowed

  const tabs = useMemo(() => {
    const available: AdminTab[] = []
    if (userManagement.allowed) {
      available.push("users")
    }
    if (director.allowed) {
      available.push("teams")
      available.push("serviceAccounts")
      available.push("impersonation")
    }
    return available
  }, [director.allowed, userManagement.allowed])

  return { userManagement, director, isLoading, allowed, tabs }
}
