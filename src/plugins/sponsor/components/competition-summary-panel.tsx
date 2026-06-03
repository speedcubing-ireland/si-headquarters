import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { formatDateRange } from "@/plugins/sponsor/components/competition-summary-format"
import { buildGoogleMapsUrl } from "@/plugins/sponsor/components/competition-summary-maps"
import { SponsorMetricDetail } from "@/plugins/sponsor/components/sponsor-metric-tile"
import type {
  SponsorshipCompetitionSummary,
  SponsorshipCompetitionSummarySource,
} from "@/convex/plugins/sponsor/lib/competitionSnapshot"

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

function eventLabel(eventId: string): string {
  const displayName = WCA_EVENT_NAME_BY_ID[eventId]
  return displayName ? displayName : eventId.toUpperCase()
}

function EventsSummary({ eventIds }: { eventIds: string[] }) {
  if (eventIds.length === 0) {
    return <p className="text-muted-foreground">Not available yet</p>
  }

  return (
    <div className="space-y-2">
      <p className="font-medium tabular-nums">
        {eventIds.length} {eventIds.length === 1 ? "event" : "events"}
      </p>
      <div className="flex flex-wrap gap-1">
        {eventIds.map((eventId) => (
          <Badge
            key={eventId}
            variant="secondary"
            className="h-6 rounded-sm px-2 text-xs font-normal"
          >
            {eventLabel(eventId)}
          </Badge>
        ))}
      </div>
    </div>
  )
}

export function AuctionCompetitionSummaryPanel(props: {
  summary: SponsorshipCompetitionSummary
  source: SponsorshipCompetitionSummarySource
}) {
  const [isOpen, setIsOpen] = useState(false)
  const address = props.summary.address.trim()
  const mapsUrl = buildGoogleMapsUrl(props.summary)
  const summaryLine = [
    formatDateRange(props.summary),
    props.summary.competitorLimit !== undefined
      ? `${String(props.summary.competitorLimit)} competitor limit`
      : "No competitor limit listed",
    props.summary.eventIds.length > 0
      ? `${String(props.summary.eventIds.length)} events`
      : "Events not listed",
  ].join(" · ")

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="gap-0 py-0">
        <CardHeader className="pt-4 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <CardDescription>Competition details</CardDescription>
              <CardTitle className="text-xl">{props.summary.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{summaryLine}</p>
            </div>
            <Badge variant="outline" className="shrink-0">
              {props.source === "wca"
                ? "Synced from WCA"
                : "Basic details only"}
            </Badge>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="border-t pt-4 pb-4">
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <SponsorMetricDetail label="Location">
                {address.length > 0 ? (
                  mapsUrl !== null ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline decoration-border underline-offset-4 hover:text-primary"
                    >
                      {address}
                    </a>
                  ) : (
                    <p className="font-medium">{address}</p>
                  )
                ) : (
                  <p className="text-muted-foreground">Not available yet</p>
                )}
              </SponsorMetricDetail>

              <SponsorMetricDetail label="Dates">
                <p className="font-medium">{formatDateRange(props.summary)}</p>
              </SponsorMetricDetail>

              <SponsorMetricDetail label="Competitor limit">
                <p className="font-medium tabular-nums">
                  {props.summary.competitorLimit !== undefined
                    ? String(props.summary.competitorLimit)
                    : "Not set"}
                </p>
              </SponsorMetricDetail>
            </div>
            <div className="mt-5 border-t pt-4">
              <SponsorMetricDetail label="Events">
                <EventsSummary eventIds={props.summary.eventIds} />
              </SponsorMetricDetail>
            </div>
          </CardContent>
        </CollapsibleContent>
        <CardFooter>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline">
              {isOpen ? "Hide details" : "Show details"}
            </Button>
          </CollapsibleTrigger>
        </CardFooter>
      </Card>
    </Collapsible>
  )
}

export function AuctionCompetitionSummaryCompact(props: {
  summary: SponsorshipCompetitionSummary
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
      {dateRange} · {limitLabel} · {eventsLabel}
    </p>
  )
}
