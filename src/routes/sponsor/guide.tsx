import { createFileRoute } from "@tanstack/react-router"
import { PortalGuidePage } from "@/plugins/sponsor/pages/portal-guide"

export const Route = createFileRoute("/sponsor/guide")({
  component: PortalGuidePage,
})
