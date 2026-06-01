import { createFileRoute } from "@tanstack/react-router"
import { PortalSettingsPage } from "@/plugins/sponsor/pages/portal-settings"

export const Route = createFileRoute("/sponsor/settings")({
  component: PortalSettingsPage,
})
