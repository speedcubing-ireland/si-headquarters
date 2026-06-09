import { useNavigate } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import { useCallback } from "react"
import { api } from "@/convex/_generated/api"
import { ImpersonationRedeemPage } from "@/features/impersonation/impersonation-redeem-page"
import { storeSponsorImpersonationSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

export function SponsorImpersonationRedeem() {
  const navigate = useNavigate()
  const redeemSponsorToken = useMutation(
    api.plugins.sponsor.impersonation.redeemToken
  )

  const redeem = useCallback(
    async (token: string) => {
      const result = await redeemSponsorToken({ token })
      storeSponsorImpersonationSessionToken(result.sessionToken)
      await navigate({ to: "/sponsor/auctions" })
    },
    [navigate, redeemSponsorToken]
  )

  return (
    <ImpersonationRedeemPage title="Sponsor impersonation" redeem={redeem} />
  )
}
