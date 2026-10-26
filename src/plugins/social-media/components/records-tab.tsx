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
import { describeRecord } from "@/convex/plugins/socialMedia/records/format"
import {
  competitionResultsUrl,
  wcaPersonUrl,
} from "@/convex/plugins/socialMedia/records/links"
import {
  RECORD_TAGS,
  RECORD_TYPES,
} from "@/convex/plugins/socialMedia/records/kinds"
import {
  formatWcaEventLabel,
  wcaEventOrder,
} from "@/convex/plugins/wca/eventLabels"
import { formatDate } from "@/lib/format/dates"
import { cn } from "@/lib/utils"
import { competitionCountryIso2 } from "@/config/lib/organisation"
import {
  defaultRecordsPeriod,
  recordsPersonKey,
  type RecordsPeriod,
  type RecordsPerson,
} from "@/plugins/social-media/components/records-filters"
import { RecordsPeriodFilter } from "@/plugins/social-media/components/records-period-filter"
import { RecordsPersonFilter } from "@/plugins/social-media/components/records-person-filter"

type RecordsCompetition = FunctionReturnType<
  typeof api.plugins.socialMedia.records.queries.list
>["competitions"][number]
type StoredRecord = RecordsCompetition["records"][number]
type RecordTag = StoredRecord["tag"]
type RecordType = StoredRecord["type"]
type RecordStatus = StoredRecord["status"]

const TAG_BADGE_VARIANT = {
  NR: "default",
  CR: "secondary",
  WR: "destructive",
} as const satisfies Record<RecordTag, string>

const STATUS_LABELS = {
  live: "Provisional",
  confirmed: "Confirmed",
  notRecord: "No longer a record",
} as const satisfies Record<RecordStatus, string>

const TYPE_LABELS = {
  single: "Single",
  average: "Average",
} as const satisfies Record<RecordType, string>

const ALL_EVENTS = "all"

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

/** The events with records in the period, plus the chosen one, in WCA order. */
function eventOptions(records: StoredRecord[], selected: string): string[] {
  const events = new Set(records.map((record) => record.eventId))
  if (selected !== ALL_EVENTS) events.add(selected)
  return [...events].sort((a, b) => wcaEventOrder(a) - wcaEventOrder(b))
}

/** The people with records in the period, by name. */
function peopleOptions(records: StoredRecord[]): RecordsPerson[] {
  const people = new Map<string, RecordsPerson>()
  for (const record of records) {
    const key = recordsPersonKey(record)
    if (!people.has(key)) people.set(key, { key, name: record.personName })
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function RecordsTab() {
  const [period, setPeriod] = useState<RecordsPeriod>(defaultRecordsPeriod)
  const [tags, setTags] = useState<RecordTag[]>([...RECORD_TAGS])
  const [types, setTypes] = useState<RecordType[]>([...RECORD_TYPES])
  const [eventId, setEventId] = useState<string>(ALL_EVENTS)
  const [person, setPerson] = useState<RecordsPerson | null>(null)
  const [audience, setAudience] = useState<Audience>("all")
  const result = useQuery(api.plugins.socialMedia.records.queries.list, {
    from: period.from ?? undefined,
    to: period.to ?? undefined,
  })

  const inPeriod = (result?.competitions ?? []).flatMap(
    (competition) => competition.records
  )
  const visible = (result?.competitions ?? [])
    .map((competition) => ({
      ...competition,
      records: competition.records.filter(
        (record) =>
          tags.includes(record.tag) &&
          types.includes(record.type) &&
          (eventId === ALL_EVENTS || record.eventId === eventId) &&
          (person === null || recordsPersonKey(record) === person.key) &&
          matchesAudience(record, audience)
      ),
    }))
    .filter((competition) => competition.records.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <RecordsPeriodFilter value={period} onChange={setPeriod} />
        <NativeSelect
          aria-label="Event"
          value={eventId}
          onChange={(event) => {
            setEventId(event.currentTarget.value)
          }}
        >
          <NativeSelectOption value={ALL_EVENTS}>All events</NativeSelectOption>
          {eventOptions(inPeriod, eventId).map((id) => (
            <NativeSelectOption key={id} value={id}>
              {formatWcaEventLabel(id)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <RecordsPersonFilter
          people={peopleOptions(inPeriod)}
          value={person}
          onChange={setPerson}
        />
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
          aria-label="Single or average"
          value={types}
          onValueChange={(value) => {
            setTypes(RECORD_TYPES.filter((type) => value.includes(type)))
          }}
        >
          {RECORD_TYPES.map((type) => (
            <ToggleGroupItem key={type} value={type}>
              {TYPE_LABELS[type]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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

      {result?.truncated === true && (
        <p className="text-sm text-muted-foreground">
          Showing only the latest records in this period; pick a shorter one to
          see the rest.
        </p>
      )}

      {result === undefined ? (
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
              key={competition.wcaCompetitionId}
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
              href={competitionResultsUrl(competition)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${competition.competitionName}'s results on ${
                competition.resultsPosted ? "the WCA website" : "WCA Live"
              }`}
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

  const notRecord = record.status === "notRecord"

  return (
    <div className={cn("flex items-start gap-2", notRecord && "opacity-60")}>
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
        <div
          className={cn("text-muted-foreground", notRecord && "line-through")}
        >
          {describeRecord(record)}
        </div>
      </div>
      <Badge variant="outline">{STATUS_LABELS[record.status]}</Badge>
      {!notRecord && (
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
      )}
    </div>
  )
}
