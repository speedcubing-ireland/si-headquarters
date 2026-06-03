import { Link, Navigate, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, BookOpen, LogOut } from "lucide-react"
import { useEffect, useState } from "react"
import type { SubmitEvent } from "react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import {
  SponsorPageHeader,
  SponsorPageShell,
} from "@/plugins/sponsor/components/sponsor-page-layout"
import { PortalThemeToggle } from "@/plugins/sponsor/components/portal-theme-toggle"
import {
  SponsorButtonSpinner,
  SponsorPageLoading,
} from "@/plugins/sponsor/components/sponsor-ui"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isSponsorshipEnabled } from "@/lib/feature-flags"
import { useSponsorPortalSignOut } from "@/plugins/sponsor/lib/use-sponsor-portal-sign-out"
import { useSponsorSessionToken } from "@/plugins/sponsor/lib/sponsor-session-token"
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result"

function toActionError(error: object, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback
  }
  const allowedMessages = new Set([
    "Sponsor session expired. Please sign in again.",
    "Display name cannot be empty.",
  ])
  if (allowedMessages.has(error.message)) {
    return error.message
  }
  return error.message || fallback
}

export function PortalSettingsPage() {
  if (!isSponsorshipEnabled) {
    return <Navigate to="/" />
  }
  return <SponsorSettingsEnabled />
}

function SponsorSettingsEnabled() {
  const navigate = useNavigate()
  const { sessionToken, isPending: authPending } = useSponsorSessionToken()
  const onLogout = useSponsorPortalSignOut()
  const meResult = useQuery(
    api.plugins.sponsor.portal.auth.me,
    sessionToken !== null ? { sessionToken } : "skip"
  )
  const meState = useRetainedQueryResult(meResult, sessionToken ?? "skip")
  const me = meState.data
  const updateDisplayName = useMutation(
    api.plugins.sponsor.portal.auth.updateDisplayName
  )
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(
    null
  )
  const [isSavingName, setIsSavingName] = useState(false)
  const displayName = displayNameOverride ?? me?.sponsor.name ?? ""

  useEffect(() => {
    if (authPending) return
    if (sessionToken !== null) return
    void navigate({ to: "/sponsor/login" })
  }, [authPending, navigate, sessionToken])

  if (authPending || sessionToken === null || meState.isLoading) {
    return <SponsorPageLoading />
  }

  const onSaveDisplayName = async (event: SubmitEvent) => {
    event.preventDefault()
    setIsSavingName(true)
    try {
      await updateDisplayName({
        sessionToken,
        displayName,
      })
      toast.success("Display name updated.")
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? toActionError(caught, "Failed to update display name.")
          : "Failed to update display name."
      )
    } finally {
      setIsSavingName(false)
    }
  }

  return (
    <SponsorPageShell maxWidthClassName="max-w-3xl">
      <SponsorPageHeader
        title="Settings"
        actions={
          <>
            <PortalThemeToggle />
            <Button variant="outline" onClick={() => void onLogout()}>
              <LogOut className="size-4" />
              Log out
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/sponsor/auctions">
            <ArrowLeft className="size-4" />
            Back to auctions
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/sponsor/guide">
            <BookOpen className="size-4" />
            Sponsor information
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your sponsor display name.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => void onSaveDisplayName(event)}
          >
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => {
                  setDisplayNameOverride(event.target.value)
                }}
                required
                disabled={isSavingName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={me?.contact?.email ?? me?.sponsor.email ?? ""}
                readOnly
                disabled
              />
            </div>
            <Button type="submit" size="sm" disabled={isSavingName}>
              {isSavingName ? <SponsorButtonSpinner /> : "Save name"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </SponsorPageShell>
  )
}
