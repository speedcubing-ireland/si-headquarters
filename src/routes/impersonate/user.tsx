import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { useAuthActions } from "@convex-dev/auth/react"
import { useCallback, useMemo } from "react"
import { AuthCallbackPage } from "@/components/public-auth-card"
import {
  clearConsumptionNonce,
  getOrCreateConsumptionNonce,
} from "@/features/impersonation/consumption-nonce"

const INVALID_IMPERSONATION_MESSAGE =
  "Impersonation link is invalid or expired."

function ImpersonateUserPage() {
  const navigate = useNavigate()
  const { signIn } = useAuthActions()
  const { token } = useSearch({ from: "/impersonate/user" })
  const consumptionNonce = useMemo(
    () => getOrCreateConsumptionNonce(token ?? ""),
    [token]
  )

  const redeem = useCallback(
    async (redeemToken: string) => {
      const result = await signIn("impersonation", {
        token: redeemToken,
        consumptionNonce,
      })
      if (!result.signingIn) {
        throw new Error(INVALID_IMPERSONATION_MESSAGE)
      }
      clearConsumptionNonce(redeemToken)
      await navigate({ to: "/" })
    },
    [consumptionNonce, navigate, signIn]
  )

  return (
    <AuthCallbackPage
      title="User impersonation"
      credential={token}
      missingMessage="Impersonation link is missing a token."
      loadingMessage="Opening impersonated session..."
      defaultErrorMessage={INVALID_IMPERSONATION_MESSAGE}
      redeem={redeem}
    />
  )
}

export const Route = createFileRoute("/impersonate/user")({
  validateSearch: (search) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: ImpersonateUserPage,
})
