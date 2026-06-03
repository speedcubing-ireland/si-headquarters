import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Copy, ExternalLink } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { ObjectAvatar } from "@/components/object-avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Page } from "@/components/layout/page"
import { formatDateTime } from "@/plugins/sponsor/lib/sponsorship-ui"
import {
  type AdminUser,
  userDisplayName,
} from "@/features/admin/users/utils"

type ImpersonationLink = FunctionReturnType<
  typeof api.impersonation.mutations.createUserLink
>

type SponsorOption = FunctionReturnType<
  typeof api.plugins.sponsor.admin.sponsors.list
>[number]

function GeneratedLinkPanel({ link }: { link: ImpersonationLink | null }) {
  if (link === null) {
    return null
  }
  return (
    <Card size="sm" className="bg-muted/30">
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm">
          <p className="font-medium">One-time impersonation link</p>
          <p className="font-mono text-xs break-all text-muted-foreground">
            {link.url}
          </p>
          <p className="text-xs text-muted-foreground">
            Link expires {formatDateTime(link.ticketExpiresAt)}. Session expires{" "}
            {formatDateTime(link.sessionExpiresAt)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(link.url).then(() => {
                toast.success("Copied impersonation link.")
              })
            }}
          >
            <Copy className="size-4" />
            Copy
          </Button>
          <Button asChild type="button" size="sm" variant="outline">
            <a href={link.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Open
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ImpersonationLinkCard({
  title,
  description,
  targetFieldId,
  reasonId,
  reason,
  onReasonChange,
  onCreate,
  busy,
  link,
  children,
}: {
  title: string
  description: string
  targetFieldId: string
  reasonId: string
  reason: string
  onReasonChange: (value: string) => void
  onCreate: () => void
  busy: boolean
  link: ImpersonationLink | null
  children: ReactNode
}) {
  const canCreate = reason.trim().length >= 3 && !busy

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field>
          <FieldLabel htmlFor={targetFieldId}>{title.slice(0, -1)}</FieldLabel>
          {children}
        </Field>
        <Field>
          <FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
          <Input
            id={reasonId}
            value={reason}
            onChange={(event) => {
              onReasonChange(event.target.value)
            }}
            placeholder="Support or troubleshooting reason"
          />
        </Field>
        <Button type="button" disabled={!canCreate} onClick={onCreate}>
          {busy ? <Spinner /> : null}
          Create {title.toLowerCase()} link
        </Button>
        <GeneratedLinkPanel link={link} />
      </CardContent>
    </Card>
  )
}

export function AdminImpersonationPage() {
  const users = useQuery(api.users.queries.listForAdmin, {})
  const sponsors = useQuery(api.plugins.sponsor.admin.sponsors.list, {})
  const createUserLink = useMutation(api.impersonation.mutations.createUserLink)
  const createSponsorLink = useMutation(
    api.impersonation.mutations.createSponsorLink
  )

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [selectedSponsor, setSelectedSponsor] = useState<SponsorOption | null>(
    null
  )
  const [userReason, setUserReason] = useState("")
  const [sponsorReason, setSponsorReason] = useState("")
  const [userLink, setUserLink] = useState<ImpersonationLink | null>(null)
  const [sponsorLink, setSponsorLink] = useState<ImpersonationLink | null>(null)
  const [busy, setBusy] = useState<"user" | "sponsor" | null>(null)

  const userOptions = useMemo(
    () =>
      (users ?? [])
        .filter((user) => !user.disabled)
        .sort((left, right) =>
          userDisplayName(left).localeCompare(userDisplayName(right))
        ),
    [users]
  )

  const sponsorOptions = useMemo(
    () =>
      (sponsors ?? [])
        .filter((sponsor) => sponsor.active && sponsor.hasAuthAccount)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [sponsors]
  )

  if (users === undefined || sponsors === undefined) {
    return <Page.Status variant="loading" message="Loading impersonation..." />
  }

  const createLink = async (
    kind: "user" | "sponsor",
    run: () => Promise<ImpersonationLink>
  ) => {
    setBusy(kind)
    try {
      const result = await run()
      if (kind === "user") {
        setUserLink(result)
      } else {
        setSponsorLink(result)
      }
      toast.success(
        kind === "user"
          ? "User impersonation link created."
          : "Sponsor impersonation link created."
      )
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not create link."
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-4 @xl/main:grid-cols-2">
      <ImpersonationLinkCard
        title="Users"
        description="Generate a one-time HQ sign-in link for an active user."
        targetFieldId="user-id"
        reasonId="user-reason"
        reason={userReason}
        onReasonChange={(value) => {
          setUserReason(value)
          setUserLink(null)
        }}
        onCreate={() => {
          if (selectedUser === null) {
            return
          }
          void createLink("user", () =>
            createUserLink({
              userId: selectedUser._id,
              reason: userReason,
            })
          )
        }}
        busy={busy === "user"}
        link={userLink}
      >
        <Combobox
          items={userOptions}
          itemToStringLabel={(user) => {
            const name = userDisplayName(user)
            return user.email !== undefined && user.email.length > 0
              ? `${name} (${user.email})`
              : name
          }}
          isItemEqualToValue={(left, right) => left._id === right._id}
          value={selectedUser}
          onValueChange={(user) => {
            setSelectedUser(user)
            setUserLink(null)
          }}
        >
          <ComboboxInput
            id="user-id"
            className="w-full"
            placeholder="Search users..."
            showClear
          />
          <ComboboxContent>
            <ComboboxEmpty>No users found.</ComboboxEmpty>
            <ComboboxList>
              <ComboboxCollection>
                {(user: AdminUser) => (
                  <ComboboxItem key={user._id} value={user}>
                    <ObjectAvatar
                      obj={{
                        _id: user._id,
                        name: user.name,
                        image: user.image,
                      }}
                      avatarUrl={user.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 truncate">
                      {userDisplayName(user)}
                      {user.email !== undefined && user.email.length > 0
                        ? ` (${user.email})`
                        : ""}
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </ImpersonationLinkCard>

      <ImpersonationLinkCard
        title="Sponsors"
        description="Generate a one-time sponsor portal link for an active sponsor."
        targetFieldId="sponsor-id"
        reasonId="sponsor-reason"
        reason={sponsorReason}
        onReasonChange={(value) => {
          setSponsorReason(value)
          setSponsorLink(null)
        }}
        onCreate={() => {
          if (selectedSponsor === null) {
            return
          }
          void createLink("sponsor", () =>
            createSponsorLink({
              sponsorId: selectedSponsor.id,
              reason: sponsorReason,
            })
          )
        }}
        busy={busy === "sponsor"}
        link={sponsorLink}
      >
        <Combobox
          items={sponsorOptions}
          itemToStringLabel={(sponsor) => `${sponsor.name} (${sponsor.email})`}
          isItemEqualToValue={(left, right) => left.id === right.id}
          value={selectedSponsor}
          onValueChange={(sponsor) => {
            setSelectedSponsor(sponsor)
            setSponsorLink(null)
          }}
        >
          <ComboboxInput
            id="sponsor-id"
            className="w-full"
            placeholder="Search sponsors..."
            showClear
          />
          <ComboboxContent>
            <ComboboxEmpty>No sponsors found.</ComboboxEmpty>
            <ComboboxList>
              <ComboboxCollection>
                {(sponsor: SponsorOption) => (
                  <ComboboxItem key={sponsor.id} value={sponsor}>
                    <span className="min-w-0 truncate">
                      {sponsor.name} ({sponsor.email})
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </ImpersonationLinkCard>
    </div>
  )
}
