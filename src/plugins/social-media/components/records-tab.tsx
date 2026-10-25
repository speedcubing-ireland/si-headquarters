import { Link } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Copy, ExternalLink } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Page } from "@/components/layout/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api } from "@/convex/_generated/api"
import { localDateOffset, localToday } from "@/convex/notifications/localTime"
import { describeRecord } from "@/convex/plugins/socialMedia/records/format"
import {
  liveCompetitionUrl,
  wcaPersonUrl,
} from "@/convex/plugins/socialMedia/records/links"
import { RECORD_TAGS } from "@/convex/plugins/socialMedia/records/kinds"
import { formatDate } from "@/lib/format/dates"
import { competitionCountryIso2 } from "@/config/lib/organisation"

type RecordsCompetition = FunctionReturnType<
  typeof api.plugins.socialMedia.records.queries.list
>[number]
type StoredRecord = RecordsCompetition["records"][number]
type RecordTag = StoredRecord["tag"]

const TAG_BADGE_VARIANT = {
  NR: "default",
  CR: "secondary",
  WR: "destructive",
} as const satisfies Record<RecordTag, string>

const PERIODS = [
  { days: 28, label: "Last 4 weeks" },
  { days: 91, label: "Last 3 months" },
  { days: 365, label: "Last 12 months" },
] as const

const AUDIENCES = {
  all: "Everyone",
  ours: "Our competitors",
  visitors: "Visitors at our competitions",
} as const

type Audience = keyof typeof AUDIENCES

function isAudience(value: string): value is Audience {
  return value in AUDIENCES
}

function matchesAudience(record: StoredRecord, audience: Audience): boolean {
  if (audience === "all") return true
  const ours = record.personCountryIso2 === competitionCountryIso2()
  return audience === "ours" ? ours : !ours
}

function recordCaption(
  record: StoredRecord,
  competition: RecordsCompetition
): string {
  return `New ${record.tag}! ${record.personName} — ${describeRecord(record)} at ${competition.competitionName}`
}

export function RecordsTab() {
  const [days, setDays] = useState<number>(PERIODS[0].days)
  const [tags, setTags] = useState<RecordTag[]>([...RECORD_TAGS])
  const [audience, setAudience] = useState<Audience>("all")
  const competitions = useQuery(api.plugins.socialMedia.records.queries.list, {
    since: localDateOffset(localToday(), -days),
  })

  const visible = (competitions ?? [])
    .map((competition) => ({
      ...competition,
      records: competition.records.filter(
        (record) =>
          tags.includes(record.tag) && matchesAudience(record, audience)
      ),
    }))
    .filter((competition) => competition.records.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect
          aria-label="Period"
          value={String(days)}
          onChange={(event) => {
            setDays(Number(event.currentTarget.value))
          }}
        >
          {PERIODS.map((period) => (
            <NativeSelectOption key={period.days} value={String(period.days)}>
              {period.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Competitors"
          value={audience}
          onChange={(event) => {
            const value = event.currentTarget.value
            if (isAudience(value)) setAudience(value)
          }}
        >
          {Object.entries(AUDIENCES).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <ToggleGroup
          type="multiple"
          variant="outline"
          aria-label="Record types"
          value={tags}
          onValueChange={(value) => {
            setTags(RECORD_TAGS.filter((tag) => value.includes(tag)))
          }}
        >
          {RECORD_TAGS.map((tag) => (
            <ToggleGroupItem key={tag} value={tag}>
              {tag}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {competitions === undefined ? (
        <Page.Status variant="loading" message="Loading records…" />
      ) : visible.length === 0 ? (
        <Page.Status
          variant="empty"
          message="No records match these filters yet."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((competition) => (
            <CompetitionRecordsCard
              key={competition.liveCompetitionId}
              competition={competition}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CompetitionRecordsCard({
  competition,
}: {
  competition: RecordsCompetition
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">
            {competition.hqCompetitionId !== null ? (
              <Link
                to="/competitions/$id"
                params={{ id: competition.hqCompetitionId }}
                className="hover:underline"
              >
                {competition.competitionName}
              </Link>
            ) : (
              competition.competitionName
            )}
          </CardTitle>
          <Button variant="ghost" size="icon-sm" asChild>
            <a
              href={liveCompetitionUrl(competition.liveCompetitionId)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${competition.competitionName} on WCA Live`}
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
        <CardDescription>
          Ended {formatDate(competition.competitionEndDate)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {competition.records.map((record) => (
          <RecordRow
            key={record.liveRecordId}
            record={record}
            competition={competition}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function RecordRow({
  record,
  competition,
}: {
  record: StoredRecord
  competition: RecordsCompetition
}) {
  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(recordCaption(record, competition))
      toast.success("Caption copied.")
    } catch {
      toast.error("Could not copy the caption.")
    }
  }

  return (
    <div className="flex items-start gap-2">
      <Badge variant={TAG_BADGE_VARIANT[record.tag]}>{record.tag}</Badge>
      <div className="min-w-0 flex-1 text-sm">
        {record.wcaId === null ? (
          <span className="font-medium">{record.personName}</span>
        ) : (
          <a
            href={wcaPersonUrl(record.wcaId)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
          >
            {record.personName}
          </a>
        )}{" "}
        <span className="text-muted-foreground">
          ({record.personCountryIso2})
        </span>
        <div className="text-muted-foreground">{describeRecord(record)}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Copy a caption for ${record.personName}'s ${record.tag}`}
        onClick={() => {
          void copyCaption()
        }}
      >
        <Copy className="size-3.5" />
      </Button>
    </div>
  )
}
