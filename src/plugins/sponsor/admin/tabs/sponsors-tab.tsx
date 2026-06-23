import { Send, ShieldX } from "lucide-react"
import { useState, type SubmitEvent } from "react"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { SponsorInlineLoading } from "@/plugins/sponsor/components/sponsor-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Id } from "@/convex/_generated/dataModel"
import { SponsorContactsPanel } from "@/plugins/sponsor/admin/components/sponsor-contacts-panel"
import { formatDateTime } from "@/lib/format/dates"
import {
  useSponsors,
  useSponsorMutations,
} from "@/plugins/sponsor/hooks/use-sponsorship"

export function SponsorsTab() {
  const { sponsors, isLoading: isLoadingSponsors } = useSponsors()
  const {
    createSponsor,
    sendAccessEmail,
    revokeSessions,
    archiveSponsor,
    unarchiveSponsor,
  } = useSponsorMutations()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [isSubmittingSponsor, setIsSubmittingSponsor] = useState(false)
  const [busySponsorId, setBusySponsorId] = useState<Id<"sponsors"> | null>(
    null
  )
  const [busyContactId, setBusyContactId] =
    useState<Id<"sponsorContacts"> | null>(null)

  const onCreateSponsor = async (event: SubmitEvent) => {
    event.preventDefault()
    setIsSubmittingSponsor(true)
    try {
      await createSponsor({ name, email, avatarUrl: avatarUrl || undefined })
      toast.success("Sponsor created.")
      setName("")
      setEmail("")
      setAvatarUrl("")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create sponsor."
      toast.error(message)
    } finally {
      setIsSubmittingSponsor(false)
    }
  }

  const onSendAccessEmail = async (sponsorId: Id<"sponsors">) => {
    setBusySponsorId(sponsorId)
    try {
      await sendAccessEmail(sponsorId)
      toast.success("Sponsor access email sent.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send access email."
      toast.error(message)
    } finally {
      setBusySponsorId(null)
    }
  }

  const onResetSessions = async (sponsorId: Id<"sponsors">) => {
    setBusySponsorId(sponsorId)
    try {
      await revokeSessions(sponsorId)
      toast.success("Sponsor sessions revoked.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to revoke sessions."
      toast.error(message)
    } finally {
      setBusySponsorId(null)
    }
  }

  const onArchiveSponsor = async (sponsorId: Id<"sponsors">) => {
    const shouldArchive = window.confirm(
      "Archive this sponsor? They will lose portal access until unarchived."
    )
    if (!shouldArchive) return
    setBusySponsorId(sponsorId)
    try {
      await archiveSponsor(sponsorId)
      toast.success("Sponsor archived and active sessions revoked.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to archive sponsor."
      toast.error(message)
    } finally {
      setBusySponsorId(null)
    }
  }

  const onUnarchiveSponsor = async (sponsorId: Id<"sponsors">) => {
    setBusySponsorId(sponsorId)
    try {
      await unarchiveSponsor(sponsorId)
      toast.success("Sponsor reactivated.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reactivate sponsor."
      toast.error(message)
    } finally {
      setBusySponsorId(null)
    }
  }

  return (
    <div className="grid gap-4 @xl/main:grid-cols-[1fr_1.4fr]">
      <Card>
        <CardHeader>
          <CardTitle>Create Sponsor</CardTitle>
          <CardDescription>
            Create sponsor accounts to invite to auctions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              void onCreateSponsor(event)
            }}
          >
            <Input
              placeholder="Sponsor name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
              }}
              required
              disabled={isSubmittingSponsor}
            />
            <Input
              type="email"
              placeholder="sponsor@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
              }}
              required
              disabled={isSubmittingSponsor}
            />
            <Input
              placeholder="Avatar URL (optional)"
              value={avatarUrl}
              onChange={(event) => {
                setAvatarUrl(event.target.value)
              }}
              disabled={isSubmittingSponsor}
            />
            <Button type="submit" disabled={isSubmittingSponsor}>
              {isSubmittingSponsor ? <Spinner /> : "Create sponsor"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sponsors and contacts</CardTitle>
          <CardDescription>
            Manage sponsor accounts, contacts, portal access, bidding authority,
            and auction email CC recipients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingSponsors ? (
            <SponsorInlineLoading className="py-8" />
          ) : sponsors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sponsors yet.</p>
          ) : (
            sponsors.map((sponsor) => (
              <div key={sponsor.id} className="space-y-3 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{sponsor.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {sponsor.email}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={sponsor.active ? "secondary" : "outline"}>
                        {sponsor.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">
                        {sponsor.hasAuthAccount
                          ? "Portal access ready"
                          : "Portal access not set up"}
                      </Badge>
                      {sponsor.lastAccessEmailSentAt !== undefined ? (
                        <Badge variant="outline">
                          Access email{" "}
                          {formatDateTime(sponsor.lastAccessEmailSentAt)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busySponsorId === sponsor.id || !sponsor.active}
                      onClick={() => {
                        void onSendAccessEmail(sponsor.id)
                      }}
                    >
                      <Send className="size-3.5" />
                      Email primary
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busySponsorId === sponsor.id}
                      onClick={() => {
                        void onResetSessions(sponsor.id)
                      }}
                    >
                      <ShieldX className="size-3.5" />
                      Revoke all
                    </Button>
                    {sponsor.active ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busySponsorId === sponsor.id}
                        onClick={() => {
                          void onArchiveSponsor(sponsor.id)
                        }}
                      >
                        Archive sponsor
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busySponsorId === sponsor.id}
                        onClick={() => {
                          void onUnarchiveSponsor(sponsor.id)
                        }}
                      >
                        Unarchive
                      </Button>
                    )}
                  </div>
                </div>
                <SponsorContactsPanel
                  sponsorId={sponsor.id}
                  sponsorActive={sponsor.active}
                  busyContactId={busyContactId}
                  onBusyContactIdChange={setBusyContactId}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
