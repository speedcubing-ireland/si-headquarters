import { createFileRoute } from "@tanstack/react-router"
import { PortalIndexPage } from "@/plugins/sponsor/pages/portal-index"

export const Route = createFileRoute("/sponsor/")({
  component: PortalIndexPage,
})
