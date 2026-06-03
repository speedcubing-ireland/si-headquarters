import { useNavigate } from "@tanstack/react-router"
import { useAuthActions } from "@convex-dev/auth/react"
import { useCallback, useMemo } from "react"
import {
  clearConsumptionNonce,
  getOrCreateConsumptionNonce,
} from "@/features/impersonation/consumption-nonce"
import { ImpersonationRedeemPage } from "@/features/impersonation/impersonation-redeem-page"
import { impersonationTokenFromSearch } from "@/features/impersonation/impersonation-token"

export function UserImpersonationRedeem() {
  const navigate = useNavigate()
  const { signIn } = useAuthActions()

  const token = useMemo(() => impersonationTokenFromSearch() ?? "", [])
  const consumptionNonce = useMemo(
    () => getOrCreateConsumptionNonce(token),
    [token]
  )

  const redeem = useCallback(
    async (redeemToken: string) => {
      const result = await signIn("impersonation", {
        token: redeemToken,
        consumptionNonce,
      })
      if (!result.signingIn) {
        throw new Error("Impersonation link is invalid or expired.")
      }
      clearConsumptionNonce(redeemToken)
      await navigate({ to: "/" })
    },
    [consumptionNonce, navigate, signIn]
  )

  return (
    <ImpersonationRedeemPage title="User impersonation" redeem={redeem} />
  )
}
