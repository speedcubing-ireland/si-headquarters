import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import { useCallback } from "react"
import { api } from "@/convex/_generated/api"
import { AuthCallbackPage } from "@/components/public-auth-card"
import { storeSponsorImpersonationSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

const INVALID_IMPERSONATION_MESSAGE =
  "Impersonation link is invalid or expired."

function SponsorImpersonatePage() {
  const navigate = useNavigate()
  const { token } = useSearch({ from: "/sponsor/impersonate" })
  const redeemSponsorToken = useMutation(
    api.plugins.sponsor.impersonation.redeemToken
  )

  const redeem = useCallback(
    async (redeemToken: string) => {
      const result = await redeemSponsorToken({ token: redeemToken })
      storeSponsorImpersonationSessionToken(result.sessionToken)
      await navigate({ to: "/sponsor/auctions" })
    },
    [navigate, redeemSponsorToken]
  )

  return (
    <AuthCallbackPage
      title="Sponsor impersonation"
      credential={token}
      missingMessage="Impersonation link is missing a token."
      loadingMessage="Opening impersonated session..."
      defaultErrorMessage={INVALID_IMPERSONATION_MESSAGE}
      redeem={redeem}
    />
  )
}

export const Route = createFileRoute("/sponsor/impersonate")({
  validateSearch: (search) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: SponsorImpersonatePage,
})
