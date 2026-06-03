import { useQuery } from "convex/react"
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
import { useEndSponsorImpersonation } from "@/features/impersonation/use-end-sponsor-impersonation"
import { useSponsorSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"

function ImpersonationBanner({
  actorName,
  expiresAt,
  onEnd,
  layout = "default",
}: {
  actorName: string
  expiresAt: number
  onEnd: () => void
  layout?: "default" | "sidebar"
}) {
  const expiresLabel = formatDistanceToNow(new Date(expiresAt), {
    addSuffix: true,
  })

  return (
    <Alert
      variant="destructive"
      layout={layout === "sidebar" ? "stacked" : "default"}
    >
      <ShieldAlert />
      <AlertTitle>Impersonating</AlertTitle>
      <AlertDescription>
        As requested by {actorName}. Expires {expiresLabel}.
      </AlertDescription>
      <AlertAction>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className={layout === "sidebar" ? "w-full" : undefined}
          onClick={onEnd}
        >
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
    <div className="group-data-[collapsible=icon]:hidden">
      <ImpersonationBanner
        layout="sidebar"
        actorName={impersonation.actorName}
        expiresAt={impersonation.expiresAt}
        onEnd={() => {
          void signOut()
        }}
      />
    </div>
  )
}

export function SponsorImpersonationBanner() {
  const { sessionToken, isImpersonating } = useSponsorSessionToken()
  const impersonation = useQuery(
    api.impersonation.queries.currentSponsorImpersonation,
    sessionToken !== null ? { sessionToken } : "skip"
  )
  const endSponsorImpersonation = useEndSponsorImpersonation()

  if (!isImpersonating || sessionToken === null || !impersonation) {
    return null
  }

  return (
    <ImpersonationBanner
      actorName={impersonation.actorName}
      expiresAt={impersonation.expiresAt}
      onEnd={() => {
        void endSponsorImpersonation(sessionToken).then(() => {
          window.location.assign("/sponsor/login")
        })
      }}
    />
  )
}
