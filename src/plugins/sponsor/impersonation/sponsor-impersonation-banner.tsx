import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { ImpersonationBanner } from "@/features/impersonation/impersonation-banner"
import { useEndSponsorImpersonation } from "@/plugins/sponsor/impersonation/use-end-sponsor-impersonation"
import { useSponsorSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

export function SponsorImpersonationBanner() {
  const { sessionToken, isImpersonating } = useSponsorSessionToken()
  const impersonation = useQuery(
    api.plugins.sponsor.impersonation.current,
    sessionToken !== null ? { sessionToken } : "skip"
  )
  const endSponsorImpersonation = useEndSponsorImpersonation()

  if (!isImpersonating || sessionToken === null || !impersonation) {
    return null
  }

  return (
    <ImpersonationBanner
      actorName={impersonation.actorName}
      expiresAt={impersonation.expiresAt}
      onEnd={() => {
        void endSponsorImpersonation(sessionToken).then(() => {
          window.location.assign("/sponsor/login")
        })
      }}
    />
  )
}
