import { Card } from "@/components/ui/card"
import { CompetitionCalendarRow as CompetitionCalendarRowView } from "@/features/competitions/list/competition-calendar-row"
import {
  groupCalendarRowsByMonth,
  type CompetitionCalendarRow,
} from "@/features/competitions/list/competition-calendar-display"
import { WeekendSlotRow } from "@/features/competitions/list/weekend-slot-row"
import { useMemo } from "react"

export function CompetitionCalendarBoard({
  rows,
  year,
}: {
  rows: CompetitionCalendarRow[]
  year: number
}) {
  const groups = useMemo(() => groupCalendarRowsByMonth(rows), [rows])

  return (
    <div className="mx-auto max-w-4xl pb-6">
      {groups.map((group, index) => (
        <section key={group.key} className={index > 0 ? "mt-10" : undefined}>
          <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <h2 className="font-heading text-base font-semibold tracking-tight">
              {group.label}
            </h2>
          </div>
          {group.rows.map((row) =>
            row.kind === "competition" ? (
              <CompetitionCalendarRowView key={row._id} row={row} />
            ) : (
              <WeekendSlotRow
                key={row.weekendStart}
                row={row}
                year={year}
              />
            )
          )}
        </section>
      ))}
    </div>
  )
}

export function CompetitionCalendarLoading() {
  return (
    <Card className="mx-auto m-4 max-w-4xl px-4 py-10 text-center text-sm text-muted-foreground">
      Loading calendar…
    </Card>
  )
}
