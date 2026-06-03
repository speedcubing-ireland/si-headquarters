import { createFileRoute } from "@tanstack/react-router"
import { SponsorshipAdminPage } from "@/plugins/sponsor/pages/admin-sponsorship"

export const Route = createFileRoute("/plugins/sponsorship")({
  component: SponsorshipAdminPage,
})
