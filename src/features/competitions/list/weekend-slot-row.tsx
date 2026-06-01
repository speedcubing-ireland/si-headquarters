import { api } from "@/convex/_generated/api"
import type { CompetitionCalendarRow } from "@/features/competitions/list/competition-calendar-display"
import { WeekendFlagPill } from "@/features/competitions/list/weekend-flag-toggle"
import { WeekendNoteTrigger } from "@/features/competitions/list/weekend-note-dialog"
import { cn } from "@/lib/utils"
import { useMutation } from "convex/react"

export function WeekendSlotRow({
  row,
  year,
}: {
  row: Extract<CompetitionCalendarRow, { kind: "weekend" }>
  year: number
}) {
  const setNote = useMutation(api.competitions.weekendSlots.mutations.setNote)
  const setAnnounced = useMutation(
    api.competitions.weekendSlots.mutations.setAnnounced
  )
  const setReserved = useMutation(
    api.competitions.weekendSlots.mutations.setReserved
  )

  const hasNote = row.note.trim().length > 0
  const hasFlags = row.announced || row.reserved
  const showFlagsAlways = hasNote || hasFlags

  return (
    <div className="group/weekend flex items-center gap-3 border-b border-border/40 px-4 py-1.5 last:border-b-0 hover:bg-muted/20">
      <span className="w-24 shrink-0 text-[11px] text-muted-foreground/60 tabular-nums">
        {row.weekendLabel}
      </span>
      <WeekendNoteTrigger
        note={row.note}
        weekendLabel={row.weekendLabel}
        className="w-full"
        onSave={async (note) => {
          await setNote({ year, weekendStart: row.weekendStart, note })
        }}
      />
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 transition-opacity",
          !showFlagsAlways &&
            "opacity-0 group-hover/weekend:opacity-100 group-focus-within/weekend:opacity-100"
        )}
      >
        <WeekendFlagPill
          label="Announced"
          tone="green"
          pressed={row.announced}
          onPressedChange={(announced) => {
            void setAnnounced({
              year,
              weekendStart: row.weekendStart,
              announced,
            })
          }}
        />
        <WeekendFlagPill
          label="Reserved"
          tone="amber"
          pressed={row.reserved}
          onPressedChange={(reserved) => {
            void setReserved({
              year,
              weekendStart: row.weekendStart,
              reserved,
            })
          }}
        />
      </div>
    </div>
  )
}
