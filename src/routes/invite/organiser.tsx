import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { useAuthActions } from "@convex-dev/auth/react"
import { useQuery } from "convex/react"
import { useCallback } from "react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import {
  AuthCallbackPage,
  PublicAuthMessage,
} from "@/components/public-auth-card"
import { formatDateTime } from "@/lib/format/dates"

const INVALID_INVITE_MESSAGE =
  "This organiser invite link is invalid, expired, or revoked. Ask the competition team for a new one."

function InviteLanding({ token }: { token: string }) {
  const navigate = useNavigate()
  const context = useQuery(api.wcaLogin.queries.inviteContext, { token })

  if (context === undefined) {
    return (
      <PublicAuthMessage
        title="Organiser invite"
        message="Checking invite..."
      />
    )
  }
  if (context === null) {
    return (
      <PublicAuthMessage
        title="Organiser invite"
        message={INVALID_INVITE_MESSAGE}
      />
    )
  }
  return (
    <PublicAuthMessage
      title="Organiser invite"
      description={`You have been invited to organise ${context.competitionName}.`}
    >
      <CardContent className="flex flex-col gap-3">
        <Button
          type="button"
          className="w-full"
          onClick={() => void navigate({ href: context.authorizeUrl })}
        >
          Sign in with WCA
        </Button>
        <p className="text-xs text-muted-foreground">
          This invite is valid until {formatDateTime(context.expiresAt)}.
          Signing in links your WCA account and gives you organiser access to
          this competition.
        </p>
      </CardContent>
    </PublicAuthMessage>
  )
}

function OrganiserInvitePage() {
  const navigate = useNavigate()
  const { signIn } = useAuthActions()
  const { token, code, state, error } = useSearch({
    from: "/invite/organiser",
  })

  const wcaRedeem = useCallback(
    async (authCode: string) => {
      const result = await signIn("wca", {
        code: authCode,
        ...(state === undefined ? {} : { inviteToken: state }),
      })
      if (!result.signingIn) {
        throw new Error(INVALID_INVITE_MESSAGE)
      }
      await navigate({ to: "/" })
    },
    [navigate, signIn, state]
  )

  if (error !== undefined) {
    return (
      <PublicAuthMessage
        title="Organiser sign in"
        message="WCA sign in was cancelled or failed. Open your invite link to try again."
      />
    )
  }
  if (code !== undefined) {
    return (
      <AuthCallbackPage
        title="Organiser sign in"
        credential={code}
        missingMessage={INVALID_INVITE_MESSAGE}
        loadingMessage="Completing WCA sign in..."
        redeem={wcaRedeem}
      />
    )
  }
  if (token !== undefined) {
    return <InviteLanding token={token} />
  }
  return (
    <PublicAuthMessage
      title="Organiser invite"
      message="This invite link is missing a token. Check that you copied the full link."
    />
  )
}

export const Route = createFileRoute("/invite/organiser")({
  validateSearch: (search) => ({
    token: typeof search.token === "string" ? search.token : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: OrganiserInvitePage,
})
