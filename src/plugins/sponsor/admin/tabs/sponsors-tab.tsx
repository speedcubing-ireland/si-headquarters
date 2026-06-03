import { Send, ShieldX } from "lucide-react"
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
import { formatDateTime } from "@/plugins/sponsor/lib/sponsorship-ui"
import type { SubmitEvent } from "react"

interface SponsorRow {
  id: Id<"sponsors">
  name: string
  email: string
  active: boolean
  hasAuthAccount: boolean
  lastAccessEmailSentAt?: number
}

export function SponsorsTab({
  sponsors,
  isLoadingSponsors,
  name,
  email,
  avatarUrl,
  isSubmittingSponsor,
  busySponsorId,
  onNameChange,
  onEmailChange,
  onAvatarUrlChange,
  onCreateSponsor,
  onSendAccessEmail,
  onResetSessions,
  onArchiveSponsor,
  onUnarchiveSponsor,
}: {
  sponsors: SponsorRow[]
  isLoadingSponsors: boolean
  name: string
  email: string
  avatarUrl: string
  isSubmittingSponsor: boolean
  busySponsorId: Id<"sponsors"> | null
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onAvatarUrlChange: (value: string) => void
  onCreateSponsor: (event: SubmitEvent) => void
  onSendAccessEmail: (sponsorId: Id<"sponsors">) => void
  onResetSessions: (sponsorId: Id<"sponsors">) => void
  onArchiveSponsor: (sponsorId: Id<"sponsors">) => void
  onUnarchiveSponsor: (sponsorId: Id<"sponsors">) => void
}) {
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
          <form className="grid gap-3" onSubmit={onCreateSponsor}>
            <Input
              placeholder="Sponsor name"
              value={name}
              onChange={(event) => {
                onNameChange(event.target.value)
              }}
              required
              disabled={isSubmittingSponsor}
            />
            <Input
              type="email"
              placeholder="sponsor@example.com"
              value={email}
              onChange={(event) => {
                onEmailChange(event.target.value)
              }}
              required
              disabled={isSubmittingSponsor}
            />
            <Input
              placeholder="Avatar URL (optional)"
              value={avatarUrl}
              onChange={(event) => {
                onAvatarUrlChange(event.target.value)
              }}
              disabled={isSubmittingSponsor}
            />
            <Button type="submit" disabled={isSubmittingSponsor}>
              {isSubmittingSponsor ? (
                <Spinner />
              ) : (
                "Create sponsor"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sponsor Security and Access</CardTitle>
          <CardDescription>
            Manage sign-in access, session revocation, and account status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingSponsors ? (
            <SponsorInlineLoading className="py-8" />
          ) : sponsors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sponsors yet.</p>
          ) : (
            sponsors.map((sponsor) => (
              <div
                key={sponsor.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
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
                      onSendAccessEmail(sponsor.id)
                    }}
                  >
                    <Send className="size-3.5" />
                    Send access email
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busySponsorId === sponsor.id}
                    onClick={() => {
                      onResetSessions(sponsor.id)
                    }}
                  >
                    <ShieldX className="size-3.5" />
                    Revoke sessions
                  </Button>
                  {sponsor.active ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busySponsorId === sponsor.id}
                      onClick={() => {
                        onArchiveSponsor(sponsor.id)
                      }}
                    >
                      Archive
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busySponsorId === sponsor.id}
                      onClick={() => {
                        onUnarchiveSponsor(sponsor.id)
                      }}
                    >
                      Unarchive
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
