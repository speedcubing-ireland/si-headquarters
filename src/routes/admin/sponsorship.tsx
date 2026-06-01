import { createFileRoute } from "@tanstack/react-router"
import { AdminSponsorshipPage } from "@/plugins/sponsor/pages/admin-sponsorship"

export const Route = createFileRoute("/admin/sponsorship")({
  component: AdminSponsorshipPage,
})
