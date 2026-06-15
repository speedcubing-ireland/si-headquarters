import { createFileRoute } from "@tanstack/react-router"
import { OrganiserInvitePage } from "@/features/organisers/organiser-invite-page"

function readSearchValue(value: string | undefined) {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

export const Route = createFileRoute("/invite/organiser")({
  validateSearch: (
    search: Partial<Record<"token" | "code" | "state" | "error", string>>
  ) => ({
    token: readSearchValue(search.token),
    code: readSearchValue(search.code),
    state: readSearchValue(search.state),
    error: readSearchValue(search.error),
  }),
  component: OrganiserInvitePage,
})
