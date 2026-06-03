import { useMutation, useQuery } from "convex/react"
import { formatDistanceToNow } from "date-fns"
import { LogOut, ShieldAlert } from "lucide-react"
import { useAuthActions } from "@convex-dev/auth/react"
import { api } from "@/convex/_generated/api"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  clearSponsorImpersonationSessionToken,
  useSponsorSessionToken,
} from "@/plugins/sponsor/lib/sponsor-session-token"

function expiryLabel(expiresAt: number): string {
  return formatDistanceToNow(new Date(expiresAt), { addSuffix: true })
}

function ImpersonationBanner({
  actorName,
  expiresAt,
  onEnd,
}: {
  actorName: string
  expiresAt: number
  onEnd: () => void
}) {
  return (
    <Alert variant="destructive">
      <ShieldAlert />
      <AlertTitle>Impersonating</AlertTitle>
      <AlertDescription>
        As requested by {actorName}. Expires {expiryLabel(expiresAt)}.
      </AlertDescription>
      <AlertAction>
        <Button type="button" size="sm" variant="destructive" onClick={onEnd}>
          <LogOut />
          End session
        </Button>
      </AlertAction>
    </Alert>
  )
}

export function UserImpersonationBanner() {
  const impersonation = useQuery(
    api.impersonation.queries.currentUserImpersonation
  )
  const { signOut } = useAuthActions()

  if (!impersonation) {
    return null
  }

  return (
    <ImpersonationBanner
      actorName={impersonation.actorName}
      expiresAt={impersonation.expiresAt}
      onEnd={() => {
        void signOut()
      }}
    />
  )
}

export function SponsorImpersonationBanner() {
  const { sessionToken, isImpersonating } = useSponsorSessionToken()
  const impersonation = useQuery(
    api.impersonation.queries.currentSponsorImpersonation,
    sessionToken !== null ? { sessionToken } : "skip"
  )
  const endSponsorImpersonation = useMutation(
    api.impersonation.mutations.endSponsorImpersonation
  )

  if (!isImpersonating || sessionToken === null || !impersonation) {
    return null
  }

  return (
    <ImpersonationBanner
      actorName={impersonation.actorName}
      expiresAt={impersonation.expiresAt}
      onEnd={() => {
        void endSponsorImpersonation({ sessionToken }).finally(() => {
          clearSponsorImpersonationSessionToken()
          window.location.assign("/sponsor/login")
        })
      }}
    />
  )
}
