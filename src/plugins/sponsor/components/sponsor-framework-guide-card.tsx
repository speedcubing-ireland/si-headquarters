import type { SponsorshipFramework } from "@/plugins/sponsor/lib/sponsorship-ui"
import {
  sponsorshipFrameworkGuide,
  sponsorshipFrameworkLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function GuideBulletList({
  title,
  items,
}: {
  title: string
  items: readonly string[]
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="mt-2 list-disc pl-6 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function GuideNotesAlert({
  notes,
  spanColumns = false,
}: {
  notes: readonly string[]
  spanColumns?: boolean
}) {
  return (
    <Alert className={spanColumns ? "sm:col-span-2" : undefined}>
      <AlertTitle>Good to know</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        {notes.map((note) => (
          <p key={note} className="mb-0">
            {note}
          </p>
        ))}
      </AlertDescription>
    </Alert>
  )
}

function SponsorFrameworkGuideBody({
  framework,
}: {
  framework: SponsorshipFramework
}) {
  const guide = sponsorshipFrameworkGuide(framework)
  const notes = guide.notes ?? []
  const hasClosing = guide.closing.length > 0
  const hasNotes = notes.length > 0

  return (
    <div className="flex flex-col gap-4">
      <p className="mb-0">{guide.summary}</p>
      {hasClosing ? (
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <GuideBulletList title="Bidding" items={guide.bidding} />
          <GuideBulletList title="Closing" items={guide.closing} />
          {hasNotes ? <GuideNotesAlert notes={notes} spanColumns /> : null}
        </div>
      ) : (
        <>
          <GuideBulletList title="Bidding" items={guide.bidding} />
          {hasNotes ? <GuideNotesAlert notes={notes} /> : null}
        </>
      )}
    </div>
  )
}

export function SponsorFrameworkGuideCard({
  framework,
  embedded = false,
}: {
  framework: SponsorshipFramework
  /** Render body only (e.g. inside an accordion on the guide page). */
  embedded?: boolean
}) {
  if (embedded) {
    return <SponsorFrameworkGuideBody framework={framework} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sponsorshipFrameworkLabel(framework)}</CardTitle>
      </CardHeader>
      <CardContent>
        <SponsorFrameworkGuideBody framework={framework} />
      </CardContent>
    </Card>
  )
}

export function SponsorFrameworkGuideGrid() {
  const frameworks: SponsorshipFramework[] = [
    "first_sealed",
    "vickrey",
    "ebay_proxy",
  ]
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {frameworks.map((framework) => (
        <SponsorFrameworkGuideCard key={framework} framework={framework} />
      ))}
    </div>
  )
}
