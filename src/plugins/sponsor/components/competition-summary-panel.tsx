import { Badge } from "@/components/ui/badge"

interface CompetitionSummary {
  name: string
  address: string
  startDate: string
  endDate: string
  competitorLimit?: number
  eventIds: string[]
}

type CompetitionSummarySource = "competition_record" | "wca"

const WCA_EVENT_NAME_BY_ID: Record<string, string> = {
  "222": "2x2x2 Cube",
  "333": "3x3x3 Cube",
  "444": "4x4x4 Cube",
  "555": "5x5x5 Cube",
  "666": "6x6x6 Cube",
  "777": "7x7x7 Cube",
  "333bf": "3x3x3 Blindfolded",
  "333fm": "3x3x3 Fewest Moves",
  "333oh": "3x3x3 One-Handed",
  clock: "Clock",
  minx: "Megaminx",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1",
  "444bf": "4x4x4 Blindfolded",
  "555bf": "5x5x5 Blindfolded",
  "333mbf": "3x3x3 Multi-Blind",
}

import { formatDateRange } from "@/plugins/sponsor/components/competition-summary-format"

function eventLabel(eventId: string): string {
  const displayName = WCA_EVENT_NAME_BY_ID[eventId]
  return displayName ? displayName : eventId.toUpperCase()
}

export function AuctionCompetitionSummaryPanel(props: {
  summary: CompetitionSummary
  source: CompetitionSummarySource
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Competition summary
          </p>
          <h2 className="text-lg font-semibold">{props.summary.name}</h2>
        </div>
        <Badge variant="outline">
          {props.source === "wca" ? "Synced from WCA" : "Basic details only"}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Address
          </p>
          <p className="text-sm">
            {props.summary.address.trim()
              ? props.summary.address
              : "Not available yet"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Dates
          </p>
          <p className="text-sm">{formatDateRange(props.summary)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Competitor limit
          </p>
          <p className="text-sm">
            {props.summary.competitorLimit !== undefined
              ? String(props.summary.competitorLimit)
              : "Not set"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Events
          </p>
          {props.summary.eventIds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {props.summary.eventIds.map((eventId) => (
                <Badge
                  key={eventId}
                  variant="secondary"
                  className="text-[11px]"
                >
                  {eventLabel(eventId)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not available yet</p>
          )}
        </div>
      </div>
    </section>
  )
}

export function AuctionCompetitionSummaryCompact(props: {
  summary: CompetitionSummary
}) {
  const dateRange = formatDateRange(props.summary)
  const limitLabel =
    props.summary.competitorLimit !== undefined
      ? `${String(props.summary.competitorLimit)} competitor limit`
      : "No competitor limit listed"
  const eventsLabel =
    props.summary.eventIds.length > 0
      ? `${String(props.summary.eventIds.length)} events`
      : "Events not listed"
  return (
    <p className="text-sm text-muted-foreground">
      Competition Summary: {dateRange} · {limitLabel} · {eventsLabel}
    </p>
  )
}
