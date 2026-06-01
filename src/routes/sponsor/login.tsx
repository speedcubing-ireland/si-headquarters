import { createFileRoute } from "@tanstack/react-router"
import { PortalLoginPage } from "@/plugins/sponsor/pages/portal-login"

export const Route = createFileRoute("/sponsor/login")({
  component: PortalLoginPage,
})
