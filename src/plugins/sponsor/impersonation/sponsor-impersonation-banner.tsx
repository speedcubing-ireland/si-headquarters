import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { ImpersonationBanner } from "@/features/impersonation/impersonation-banner"
import { useSponsorPortalSignOut } from "@/plugins/sponsor/lib/use-sponsor-portal-sign-out"
import { useSponsorSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

export function SponsorImpersonationBanner() {
  const signOut = useSponsorPortalSignOut()
  const { sessionToken, isImpersonating } = useSponsorSessionToken()
  const impersonation = useQuery(
    api.plugins.sponsor.impersonation.current,
    sessionToken !== null ? { sessionToken } : "skip"
  )

  if (!isImpersonating || sessionToken === null || !impersonation) {
    return null
  }

  return (
    <ImpersonationBanner
      actorName={impersonation.actorName}
      expiresAt={impersonation.expiresAt}
      onEnd={() => void signOut()}
    />
  )
}
