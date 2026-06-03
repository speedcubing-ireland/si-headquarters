import { createFileRoute } from "@tanstack/react-router"
import { Wca2faPage } from "@/plugins/wca-2fa/wca-2fa-page"

export const Route = createFileRoute("/plugins/wca-2fa")({
  component: Wca2faPage,
})
