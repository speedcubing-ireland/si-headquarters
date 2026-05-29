import { Dot } from "@/components/data-selectors/phase-selector"
import { PHASE_COLOR_CLASSES } from "@/components/data-selectors/phase-meta"
import { CompetitionCalendarPeopleFields } from "@/features/competitions/competition-people-selectors"
import { CompetitionDateChipBox } from "@/features/competitions/list/competition-date-chip"
import {
  getCompetitionDateChip,
  type CompetitionCalendarCompetitionRow,
} from "@/features/competitions/list/competition-calendar-display"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"

export function CompetitionCalendarRow({
  row,
}: {
  row: CompetitionCalendarCompetitionRow
}) {
  const chip = getCompetitionDateChip(row)

  return (
    <div className="group mx-3 my-2 flex items-stretch gap-3 rounded-lg border bg-card px-4 py-4 shadow-sm transition-shadow hover:bg-muted/30 hover:shadow-md">
      <span
        className={cn(
          "w-1.5 shrink-0 self-stretch rounded-full",
          row.phase
            ? PHASE_COLOR_CLASSES[row.phase.color]
            : "bg-muted-foreground/30"
        )}
        aria-hidden
      />

      <Link
        to="/competitions/$id"
        params={{ id: row._id }}
        className="shrink-0 transition-opacity hover:opacity-90"
      >
        <CompetitionDateChipBox chip={chip} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/competitions/$id"
            params={{ id: row._id }}
            className="truncate text-base font-semibold hover:underline"
          >
            {row.name}
          </Link>
          {row.phase ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
              <Dot className="size-2" color={row.phase.color} />
              {row.phase.name}
            </span>
          ) : null}
        </div>
        <CompetitionCalendarPeopleFields row={row} />
      </div>
    </div>
  )
}
