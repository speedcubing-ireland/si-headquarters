import { createFileRoute, Navigate } from "@tanstack/react-router"
import { SponsorImpersonationRedeem } from "@/features/impersonation/sponsor-redeem"
import { isSponsorshipEnabled } from "@/lib/feature-flags"

export const Route = createFileRoute("/sponsor/impersonate")({
  component: SponsorImpersonationRoute,
})

function SponsorImpersonationRoute() {
  if (!isSponsorshipEnabled) {
    return <Navigate to="/" />
  }
  return <SponsorImpersonationRedeem />
}
