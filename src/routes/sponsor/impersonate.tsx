import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { ImpersonationRedeemPage } from "@/features/impersonation/impersonation-redeem-page"
import { isSponsorshipEnabled } from "@/lib/feature-flags"
import { storeSponsorImpersonationSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

export const Route = createFileRoute("/sponsor/impersonate")({
  component: SponsorImpersonationRoute,
})

function SponsorImpersonationRoute() {
  if (!isSponsorshipEnabled) {
    return <Navigate to="/" />
  }
  return <SponsorImpersonationEnabled />
}

function SponsorImpersonationEnabled() {
  const navigate = useNavigate()
  const redeem = useMutation(api.impersonation.mutations.redeemSponsorToken)

  return (
    <ImpersonationRedeemPage
      title="Sponsor impersonation"
      redeem={async (token) => {
        const result = await redeem({ token })
        storeSponsorImpersonationSessionToken(result.sessionToken)
        await navigate({ to: "/sponsor/auctions" })
      }}
    />
  )
}
