import { Navigate } from "@tanstack/react-router"
import { isSponsorshipEnabled } from "@/lib/feature-flags"
import { useSponsorSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

export function PortalIndexPage() {
  if (!isSponsorshipEnabled) {
    return <Navigate to="/" />
  }
  return <SponsorIndexEnabled />
}

function SponsorIndexEnabled() {
  const { sessionToken, isPending } = useSponsorSessionToken()
  if (isPending) {
    return null
  }
  if (sessionToken !== null) {
    return <Navigate to="/sponsor/auctions" />
  }
  return <Navigate to="/sponsor/login" />
}
