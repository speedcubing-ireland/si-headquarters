import type { ReactNode } from "react"
import { Page } from "@/components/layout/page"
import { useAdminAccess } from "@/features/admin/use-admin-access"

export function AdminAccessGuard({
  children,
  loadingMessage = "Loading admin…",
  deniedMessage = "Admin access is required.",
}: {
  children: ReactNode
  loadingMessage?: string
  deniedMessage?: string
}) {
  const { isLoading, allowed } = useAdminAccess()

  if (isLoading) {
    return <Page.Status variant="loading" message={loadingMessage} />
  }
  if (!allowed) {
    return <Page.Status variant="denied" message={deniedMessage} />
  }
  return children
}
