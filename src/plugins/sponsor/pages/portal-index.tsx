import { Navigate } from "@tanstack/react-router"
import { useSponsorSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

export function PortalIndexPage() {
  const { sessionToken, isPending } = useSponsorSessionToken()
  if (isPending) {
    return null
  }
  if (sessionToken !== null) {
    return <Navigate to="/sponsor/auctions" />
  }
  return <Navigate to="/sponsor/login" />
}
