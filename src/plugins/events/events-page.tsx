import { Link } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Page, PAGE_CONTENT_PADDING } from "@/components/layout/page"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateRange } from "@/lib/format/dates"
import {
  buildEventColumns,
  columnRoundTotals,
  eventRoundsById,
  filterEventReportRows,
  grandTotalRounds,
  reportFetchedAt,
  totalRounds,
  type EventReportScope,
} from "@/plugins/events/event-report"
import { useEventReport } from "@/plugins/events/use-event-report"
import { formatWcaEventShortLabel } from "@/lib/wca-events"
import { useConfiguredToday } from "@/hooks/use-configured-today"
import {
  competitionPrimaryEnd,
  competitionPrimaryStart,
} from "@/convex/competitions/dates"

const REPORT_SCOPES: readonly {
  value: EventReportScope
  label: string
}[] = [
  { value: "current", label: "Current" },
  { value: "past", label: "Past" },
]

function isEventReportScope(value: string): value is EventReportScope {
  return REPORT_SCOPES.some((scope) => scope.value === value)
}

function CompetitionLinks({
  sheetUrl,
  wcaUrl,
  competitionName,
}: {
  sheetUrl?: string
  wcaUrl?: string
  competitionName: string
}) {
  if (wcaUrl === undefined && sheetUrl === undefined) {
    return null
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      {wcaUrl !== undefined ? (
        <a
          href={wcaUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Open ${competitionName} on the WCA website`}
          title="Open WCA competition"
        >
          <ExternalLink className="size-3.5" />
        </a>
      ) : null}
      {sheetUrl !== undefined ? (
        <a
          href={sheetUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Sheet
        </a>
      ) : null}
    </span>
  )
}

export function EventsPage() {
  const { rows, error, isLoading, isRefreshing, refresh } = useEventReport()
  const [scope, setScope] = useState<EventReportScope>("current")
  const today = useConfiguredToday()
  const visibleRows = useMemo(
    () => filterEventReportRows(rows ?? [], scope, today),
    [rows, scope, today]
  )
  const eventColumns = useMemo(
    () => buildEventColumns(visibleRows),
    [visibleRows]
  )
  const columnTotals = useMemo(
    () => columnRoundTotals(visibleRows),
    [visibleRows]
  )
  const grandTotal = useMemo(() => grandTotalRounds(visibleRows), [visibleRows])
  const lastUpdated = reportFetchedAt(rows ?? [])

  return (
    <Page.Root>
      <Page.Header>
        <Page.Title>Events</Page.Title>
        {lastUpdated !== null ? (
          <span className="hidden text-xs text-muted-foreground @md/main:inline">
            Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
          </span>
        ) : null}
        <Page.Actions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading || isRefreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw className={isRefreshing ? "animate-spin" : undefined} />
            Refresh
          </Button>
        </Page.Actions>
      </Page.Header>
      <Page.Toolbar className="py-2">
        <Tabs
          value={scope}
          onValueChange={(value) => {
            if (isEventReportScope(value)) {
              setScope(value)
            }
          }}
        >
          <TabsList>
            {REPORT_SCOPES.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Page.Toolbar>
      <Page.Content className={PAGE_CONTENT_PADDING}>
        {error !== null ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle />
            <AlertTitle>Events could not be loaded</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {isLoading ? (
          <Page.Status variant="loading" message="Loading event schedules…" />
        ) : null}
        {!isLoading && rows?.length === 0 ? (
          <Page.Status variant="empty" message="No competitions to show yet." />
        ) : null}
        {!isLoading &&
        rows !== null &&
        rows.length > 0 &&
        visibleRows.length === 0 ? (
          <Page.Status
            variant="empty"
            message={`No ${scope} competitions to show.`}
          />
        ) : null}
        {visibleRows.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 min-w-52 bg-background">
                    Competition
                  </TableHead>
                  {eventColumns.map((eventId) => (
                    <TableHead key={eventId} className="h-9 px-1.5 text-center">
                      {formatWcaEventShortLabel(eventId)}
                    </TableHead>
                  ))}
                  <TableHead className="sticky right-0 z-20 h-9 bg-background text-center">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => {
                  const rounds = eventRoundsById(row)
                  const startDate = competitionPrimaryStart(row.dates)
                  const formattedDates =
                    startDate === null
                      ? "Date not set"
                      : formatDateRange(
                          startDate,
                          competitionPrimaryEnd(row.dates) ?? startDate
                        )
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="sticky left-0 z-10 bg-background">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {row.competitionId !== null ? (
                              <Link
                                to="/competitions/$id"
                                params={{ id: row.competitionId }}
                                className="block truncate font-medium hover:underline"
                              >
                                {row.competitionName}
                              </Link>
                            ) : (
                              <span className="block truncate font-medium">
                                {row.competitionName}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              {formattedDates}
                            </span>
                            {row.error !== null ? (
                              <span
                                className="mt-0.5 flex max-w-48 items-center gap-1 truncate text-[11px] text-destructive"
                                title={row.error}
                              >
                                <AlertTriangle className="size-3 shrink-0" />
                                {row.error}
                              </span>
                            ) : null}
                          </div>
                          <CompetitionLinks
                            sheetUrl={row.sheet?.url ?? undefined}
                            wcaUrl={row.wcaCompetition?.url ?? undefined}
                            competitionName={row.competitionName}
                          />
                        </div>
                      </TableCell>
                      {eventColumns.map((eventId) => {
                        const value = rounds.get(eventId)
                        return (
                          <TableCell
                            key={eventId}
                            className={
                              value === undefined
                                ? "px-1.5 text-center text-muted-foreground/40"
                                : "px-1.5 text-center font-medium tabular-nums"
                            }
                          >
                            {value ?? "—"}
                          </TableCell>
                        )
                      })}
                      <TableCell className="sticky right-0 z-10 bg-background text-center font-semibold tabular-nums">
                        {row.error === null ? totalRounds(row) : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-background font-semibold">
                    Total
                  </TableCell>
                  {eventColumns.map((eventId) => (
                    <TableCell
                      key={eventId}
                      className="px-1.5 text-center font-semibold tabular-nums"
                    >
                      {columnTotals.get(eventId) ?? 0}
                    </TableCell>
                  ))}
                  <TableCell className="sticky right-0 z-10 bg-background text-center font-semibold tabular-nums">
                    {grandTotal}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ) : null}
      </Page.Content>
    </Page.Root>
  )
}
