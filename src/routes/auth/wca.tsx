import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { useAuthActions } from "@convex-dev/auth/react"
import { useCallback } from "react"
import {
  AuthCallbackPage,
  PublicAuthMessage,
} from "@/components/public-auth-card"

const NOT_STAFF_MESSAGE =
  "This WCA account is not set up as staff. Ask an administrator to add your WCA account before signing in."

function StaffWcaLoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuthActions()
  const { code, error } = useSearch({ from: "/auth/wca" })

  const wcaRedeem = useCallback(
    async (authCode: string) => {
      const result = await signIn("wca-staff", { code: authCode })
      if (!result.signingIn) {
        throw new Error(NOT_STAFF_MESSAGE)
      }
      await navigate({ to: "/" })
    },
    [navigate, signIn]
  )

  if (error !== undefined) {
    return (
      <PublicAuthMessage
        title="Staff sign in"
        message="WCA sign in was cancelled or failed. Return to the sign-in page to try again."
      />
    )
  }
  if (code !== undefined) {
    return (
      <AuthCallbackPage
        title="Staff sign in"
        credential={code}
        missingMessage={NOT_STAFF_MESSAGE}
        loadingMessage="Completing WCA sign in..."
        redeem={wcaRedeem}
      />
    )
  }
  return (
    <PublicAuthMessage
      title="Staff sign in"
      message="Open the sign-in page and choose Sign in with WCA to continue."
    />
  )
}

export const Route = createFileRoute("/auth/wca")({
  validateSearch: (search) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: StaffWcaLoginPage,
})
