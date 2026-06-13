import { createFileRoute } from "@tanstack/react-router"
import { OrganiserInvitePage } from "@/features/organisers/organiser-invite-page"

export const Route = createFileRoute("/invite/organiser")({
  component: OrganiserInvitePage,
})
