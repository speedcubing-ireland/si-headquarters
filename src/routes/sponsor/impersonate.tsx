import { createFileRoute } from "@tanstack/react-router"
import { SponsorImpersonationRedeem } from "@/features/impersonation/sponsor-redeem"

export const Route = createFileRoute("/sponsor/impersonate")({
  component: SponsorImpersonationRedeem,
})
