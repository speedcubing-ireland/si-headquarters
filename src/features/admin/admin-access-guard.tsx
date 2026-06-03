import type { ReactNode } from "react"
import { Page } from "@/components/layout/page"
import { useCan } from "@/features/auth/ability"

export function AdminAccessGuard({
  children,
  loadingMessage = "Loading admin…",
  deniedMessage = "Admin access is required.",
}: {
  children: ReactNode
  loadingMessage?: string
  deniedMessage?: string
}) {
  const userManagement = useCan("manage", "UserManagement")
  const impersonation = useCan("manage", "all")

  const isLoading = userManagement.isLoading || impersonation.isLoading

  const allowed = userManagement.allowed || impersonation.allowed

  if (isLoading) {
    return <Page.Status variant="loading" message={loadingMessage} />
  }
  if (!allowed) {
    return <Page.Status variant="denied" message={deniedMessage} />
  }
  return children
}
