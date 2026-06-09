import { createFileRoute } from "@tanstack/react-router"
import { SponsorImpersonationRedeem } from "@/plugins/sponsor/impersonation/sponsor-redeem"

export const Route = createFileRoute("/sponsor/impersonate")({
  component: SponsorImpersonationRedeem,
})
