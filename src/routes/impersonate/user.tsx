import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAuthActions } from "@convex-dev/auth/react"
import { ImpersonationRedeemPage } from "@/features/impersonation/impersonation-redeem-page"

export const Route = createFileRoute("/impersonate/user")({
  component: UserImpersonationRoute,
})

function UserImpersonationRoute() {
  const navigate = useNavigate()
  const { signIn } = useAuthActions()

  return (
    <ImpersonationRedeemPage
      title="User impersonation"
      redeem={async (token) => {
        const result = await signIn("impersonation", { token })
        if (!result.signingIn) {
          throw new Error("Impersonation link is invalid or expired.")
        }
        await navigate({ to: "/" })
      }}
    />
  )
}
