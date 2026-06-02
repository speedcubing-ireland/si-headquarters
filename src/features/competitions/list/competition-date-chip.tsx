import type { CompetitionDateChip } from "@/features/competitions/list/competition-calendar-display"
import { cn } from "@/lib/utils"

const CHIP_BOX_CLASS =
  "flex size-14 shrink-0 flex-col items-center justify-center rounded-md border border-border/60 bg-muted/50 text-center"

function ChipMonthLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] leading-none font-medium text-muted-foreground uppercase">
      {children}
    </span>
  )
}

function ChipDayValue({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "leading-none font-semibold text-foreground tabular-nums",
        className
      )}
    >
      {children}
    </span>
  )
}

export function CompetitionDateChipBox({
  chip,
}: {
  chip: CompetitionDateChip
}) {
  if (chip.kind === "tbd") {
    return (
      <div className={CHIP_BOX_CLASS} aria-label="Dates to be determined">
        <ChipMonthLabel>TBD</ChipMonthLabel>
        <ChipDayValue className="mt-1 text-lg text-muted-foreground">
          —
        </ChipDayValue>
      </div>
    )
  }

  if (chip.kind === "single") {
    return (
      <div className={CHIP_BOX_CLASS} aria-label={`${chip.month} ${chip.day}`}>
        <ChipMonthLabel>{chip.month}</ChipMonthLabel>
        <ChipDayValue className="mt-1 text-xl">{chip.day}</ChipDayValue>
      </div>
    )
  }

  if (chip.kind === "range") {
    return (
      <div
        className={CHIP_BOX_CLASS}
        aria-label={`${chip.month} ${chip.startDay} to ${chip.endDay}`}
      >
        <ChipMonthLabel>{chip.month}</ChipMonthLabel>
        <ChipDayValue className="mt-1 text-base">
          {chip.startDay}–{chip.endDay}
        </ChipDayValue>
      </div>
    )
  }

  return (
    <div
      className={CHIP_BOX_CLASS}
      aria-label={`${chip.startMonth} ${chip.startDay} to ${chip.endMonth} ${chip.endDay}`}
    >
      <div className="flex w-full items-center justify-between gap-1 px-1.5">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <ChipMonthLabel>{chip.startMonth}</ChipMonthLabel>
          <ChipDayValue className="text-sm">{chip.startDay}</ChipDayValue>
        </div>
        <span
          className="shrink-0 text-[10px] leading-none text-muted-foreground"
          aria-hidden
        >
          –
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <ChipMonthLabel>{chip.endMonth}</ChipMonthLabel>
          <ChipDayValue className="text-sm">{chip.endDay}</ChipDayValue>
        </div>
      </div>
    </div>
  )
}
