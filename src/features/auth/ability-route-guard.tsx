import type { ReactNode } from "react"
import { Page } from "@/components/layout/page"
import { useCan, type Action, type Subject } from "@/features/auth/ability"

export function AbilityRouteGuard({
  action,
  subject,
  deniedMessage,
  loadingMessage = "Loading…",
  children,
}: {
  action: Action
  subject: Subject
  deniedMessage: string
  loadingMessage?: string
  children: ReactNode
}) {
  const { allowed, isLoading } = useCan(action, subject)

  if (isLoading) {
    return <Page.Status variant="loading" message={loadingMessage} />
  }
  if (!allowed) {
    return <Page.Status variant="denied" message={deniedMessage} />
  }
  return children
}
