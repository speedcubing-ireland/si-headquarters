import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { CircleCheckIcon, SaveIcon, UnplugIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Page } from "@/components/layout/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { isFeatureEnabled } from "@/config/lib/organisation"
import { api } from "@/convex/_generated/api"
import { unknownErrorMessage } from "@/convex/integrations/errorPayload"
import { formatDateTime } from "@/lib/format/dates"

type AppSettings = FunctionReturnType<typeof api.settings.appSettings.get>

/**
 * A local copy of a server value that follows the server whenever its contents
 * change (first load, or another director saving), discarding local edits as
 * the WCA phases screen does. Values are compared by their JSON form, so a
 * re-render with an equal object keeps the edits.
 */
function useDraft<T>(serverValue: T) {
  const serverKey = JSON.stringify(serverValue)
  const [state, setState] = useState({ serverKey, draft: serverValue })
  if (state.serverKey !== serverKey) {
    setState({ serverKey, draft: serverValue })
  }
  const draft = state.serverKey === serverKey ? state.draft : serverValue
  return {
    draft,
    setDraft: (next: T) => {
      setState({ serverKey, draft: next })
    },
    isDirty: JSON.stringify(draft) !== serverKey,
  }
}

function StatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <Badge>
      <CircleCheckIcon />
      Configured
    </Badge>
  ) : (
    <Badge variant="outline">
      <UnplugIcon />
      Not configured
    </Badge>
  )
}

function SettingsCard({
  title,
  description,
  configured,
  updatedAt,
  isDirty,
  onSave,
  children,
}: {
  title: string
  description: string
  configured: boolean
  updatedAt: number | null
  isDirty: boolean
  onSave: () => Promise<void>
  children: ReactNode
}) {
  const [saving, setSaving] = useState(false)
  const formId = useId()

  const save = async () => {
    setSaving(true)
    try {
      await onSave()
      toast.success(`${title} saved.`)
    } catch (error) {
      toast.error(unknownErrorMessage(error, { includeConvexError: true }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <StatusBadge configured={configured} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <fieldset disabled={saving}>{children}</fieldset>
        </form>
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {updatedAt === null
            ? "Never saved."
            : `Last changed ${formatDateTime(updatedAt)}.`}
        </p>
        <Button type="submit" form={formId} disabled={saving || !isDirty}>
          {saving ? <Spinner /> : <SaveIcon />}
          Save
        </Button>
      </CardFooter>
    </Card>
  )
}

const CANVA_PRESETS = [
  { key: "certificates", label: "Certificates" },
  { key: "lanyards", label: "Lanyards" },
] as const

type CanvaDraft = Record<
  (typeof CANVA_PRESETS)[number]["key"],
  { brandTemplateId: string; outputFolderId: string }
>

function CanvaSettingsCard({ settings }: { settings: AppSettings["canva"] }) {
  const update = useMutation(api.settings.appSettings.updateCanva)
  const server: CanvaDraft = {
    certificates: settings.certificates ?? {
      brandTemplateId: "",
      outputFolderId: "",
    },
    lanyards: settings.lanyards ?? { brandTemplateId: "", outputFolderId: "" },
  }
  const { draft, setDraft, isDirty } = useDraft(server)

  const toArg = (value: CanvaDraft[keyof CanvaDraft]) =>
    value.brandTemplateId.trim() === "" && value.outputFolderId.trim() === ""
      ? null
      : value

  return (
    <SettingsCard
      title="Canva"
      description="The brand template each Canva integration fills in, and the folder the new design is saved to. Leave a preset empty to disable it."
      configured={settings.certificates !== null || settings.lanyards !== null}
      updatedAt={settings.updatedAt}
      isDirty={isDirty}
      onSave={async () => {
        await update({
          certificates: toArg(draft.certificates),
          lanyards: toArg(draft.lanyards),
        })
      }}
    >
      <FieldGroup>
        {CANVA_PRESETS.map((preset) => (
          <FieldSet key={preset.key}>
            <FieldLegend variant="label">{preset.label}</FieldLegend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`canva-${preset.key}-template`}>
                  Brand template ID
                </FieldLabel>
                <Input
                  id={`canva-${preset.key}-template`}
                  className="font-mono"
                  value={draft[preset.key].brandTemplateId}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      [preset.key]: {
                        ...draft[preset.key],
                        brandTemplateId: event.target.value,
                      },
                    })
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`canva-${preset.key}-folder`}>
                  Output folder ID
                </FieldLabel>
                <Input
                  id={`canva-${preset.key}-folder`}
                  className="font-mono"
                  value={draft[preset.key].outputFolderId}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      [preset.key]: {
                        ...draft[preset.key],
                        outputFolderId: event.target.value,
                      },
                    })
                  }}
                />
              </Field>
            </div>
          </FieldSet>
        ))}
      </FieldGroup>
    </SettingsCard>
  )
}

function RecordsEmailSettingsCard({
  settings,
}: {
  settings: AppSettings["recordsEmail"]
}) {
  const update = useMutation(api.settings.appSettings.updateRecordsEmail)
  const server = {
    recipients: settings.recipients.join("\n"),
    senderAddress: settings.senderAddress ?? "",
  }
  const { draft, setDraft, isDirty } = useDraft(server)

  return (
    <SettingsCard
      title="Weekly records email"
      description="Who receives Monday's email of records set by the organisation's competitors, and who it comes from."
      configured={settings.senderAddress !== null}
      updatedAt={settings.updatedAt}
      isDirty={isDirty}
      onSave={async () => {
        await update({
          recipients: [draft.recipients],
          senderAddress: draft.senderAddress,
        })
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="records-recipients">Recipients</FieldLabel>
          <Textarea
            id="records-recipients"
            rows={3}
            placeholder="social@example.com"
            value={draft.recipients}
            onChange={(event) => {
              setDraft({ ...draft, recipients: event.target.value })
            }}
          />
          <FieldDescription>
            One address per line, or separated by commas.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="records-sender">Sender</FieldLabel>
          <Input
            id="records-sender"
            placeholder="Headquarters <noreply@example.com>"
            value={draft.senderAddress}
            onChange={(event) => {
              setDraft({ ...draft, senderAddress: event.target.value })
            }}
          />
          <FieldDescription>
            Must be on a domain verified in Resend.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </SettingsCard>
  )
}

function SponsorshipEmailSettingsCard({
  settings,
}: {
  settings: AppSettings["sponsorshipEmail"]
}) {
  const update = useMutation(api.settings.appSettings.updateSponsorshipEmail)
  const server = settings.senderAddress ?? ""
  const { draft, setDraft, isDirty } = useDraft(server)

  return (
    <SettingsCard
      title="Sponsorship emails"
      description="The sender of sponsor portal sign-in codes and sponsorship emails."
      configured={settings.senderAddress !== null}
      updatedAt={settings.updatedAt}
      isDirty={isDirty}
      onSave={async () => {
        await update({ senderAddress: draft.trim() === "" ? null : draft })
      }}
    >
      <Field>
        <FieldLabel htmlFor="sponsorship-sender">Sender</FieldLabel>
        <Input
          id="sponsorship-sender"
          placeholder={settings.defaultSenderAddress ?? undefined}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
        />
        <FieldDescription>
          Must be on a domain verified in Resend. Leave empty to send from the
          sponsorship team address
          {settings.defaultSenderAddress === null
            ? ""
            : ` (${settings.defaultSenderAddress})`}
          .
        </FieldDescription>
      </Field>
    </SettingsCard>
  )
}

function AchievementsSettingsCard({
  settings,
}: {
  settings: AppSettings["achievements"]
}) {
  const update = useMutation(api.settings.appSettings.updateAchievements)
  const server = settings.siteUrl ?? ""
  const { draft, setDraft, isDirty } = useDraft(server)

  return (
    <SettingsCard
      title="SI Achievements"
      description="Where the badges link on competition tasks points. Leave empty to hide the link."
      configured={settings.siteUrl !== null}
      updatedAt={settings.updatedAt}
      isDirty={isDirty}
      onSave={async () => {
        await update({ siteUrl: draft.trim() === "" ? null : draft })
      }}
    >
      <Field>
        <FieldLabel htmlFor="achievements-site">Site URL</FieldLabel>
        <Input
          id="achievements-site"
          type="url"
          placeholder="https://achievements.example.com"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
        />
        <FieldDescription>
          Badges link to {"<url>"}/competitions/{"<WCA competition ID>"}.
        </FieldDescription>
      </Field>
    </SettingsCard>
  )
}

/**
 * Operational settings that used to be Convex env vars. Secrets and the URLs
 * that identify the deployment stay in env; see `convex/settings/validators.ts`.
 */
export function AdminSettingsPage() {
  const settings = useQuery(api.settings.appSettings.get, {})

  if (settings === undefined) {
    return <Page.Status variant="loading" message="Loading settings…" />
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Day-to-day configuration for this deployment. Credentials and site
          URLs are set in the Convex environment instead.
        </p>
      </div>
      {isFeatureEnabled("canva") ? (
        <CanvaSettingsCard settings={settings.canva} />
      ) : null}
      {isFeatureEnabled("records") ? (
        <RecordsEmailSettingsCard settings={settings.recordsEmail} />
      ) : null}
      {isFeatureEnabled("sponsors") ? (
        <SponsorshipEmailSettingsCard settings={settings.sponsorshipEmail} />
      ) : null}
      {isFeatureEnabled("wcaIntegration") ? (
        <AchievementsSettingsCard settings={settings.achievements} />
      ) : null}
    </div>
  )
}
