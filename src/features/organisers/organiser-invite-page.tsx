import { useNavigate, useSearch } from "@tanstack/react-router"
import { useAuthActions } from "@convex-dev/auth/react"
import { useQuery } from "convex/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { formatDateTime } from "@/lib/format/irish-dates"

const INVALID_INVITE_MESSAGE =
  "This organiser invite link is invalid, expired, or revoked. Ask the competition team for a new one."

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  )
}

function InviteMessage({ title, message }: { title: string; message: string }) {
  return (
    <InviteShell>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {message}
      </CardContent>
    </InviteShell>
  )
}

function InviteLanding({ token }: { token: string }) {
  const context = useQuery(api.organisers.queries.inviteContext, { token })

  if (context === undefined) {
    return (
      <InviteMessage title="Organiser invite" message="Checking invite..." />
    )
  }
  if (context === null) {
    return (
      <InviteMessage
        title="Organiser invite"
        message={INVALID_INVITE_MESSAGE}
      />
    )
  }
  return (
    <InviteShell>
      <CardHeader>
        <CardTitle>Organiser invite</CardTitle>
        <CardDescription>
          You have been invited to organise {context.competitionName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            window.location.assign(context.authorizeUrl)
          }}
        >
          Sign in with WCA
        </Button>
        <p className="text-xs text-muted-foreground">
          This invite is valid until {formatDateTime(context.expiresAt)}.
          Signing in links your WCA account and gives you organiser access to
          this competition.
        </p>
      </CardContent>
    </InviteShell>
  )
}

function WcaCallbackRedeem({
  code,
  inviteToken,
}: {
  code: string
  inviteToken: string | undefined
}) {
  const navigate = useNavigate()
  const { signIn } = useAuthActions()
  const [error, setError] = useState<string | null>(null)
  const attemptedCodeRef = useRef<string | null>(null)

  useEffect(() => {
    if (attemptedCodeRef.current === code) {
      return
    }
    attemptedCodeRef.current = code

    void (async () => {
      try {
        const result = await signIn("wca", {
          code,
          ...(inviteToken === undefined ? {} : { inviteToken }),
        })
        if (!result.signingIn) {
          throw new Error(INVALID_INVITE_MESSAGE)
        }
        await navigate({ to: "/" })
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : INVALID_INVITE_MESSAGE
        )
      }
    })()
  }, [code, inviteToken, navigate, signIn])

  return (
    <InviteShell>
      <CardHeader>
        <CardTitle>Organiser sign in</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
        {error ?? (
          <div className="flex items-center gap-2">
            <Spinner />
            Completing WCA sign in...
          </div>
        )}
      </CardContent>
    </InviteShell>
  )
}

export function OrganiserInvitePage() {
  const { token, code, state, error } = useSearch({
    from: "/invite/organiser",
  })

  if (error !== undefined) {
    return (
      <InviteMessage
        title="Organiser sign in"
        message="WCA sign in was cancelled or failed. Open your invite link to try again."
      />
    )
  }
  if (code !== undefined) {
    return <WcaCallbackRedeem code={code} inviteToken={state} />
  }
  if (token !== undefined) {
    return <InviteLanding token={token} />
  }
  return (
    <InviteMessage
      title="Organiser invite"
      message="This invite link is missing a token. Check that you copied the full link."
    />
  )
}
