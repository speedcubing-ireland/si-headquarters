import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useState } from "react"
import type { DateRange } from "react-day-picker"
import * as SelectorFace from "@/components/data-selectors/selector-face"
import { SelectorButton } from "@/components/data-selectors/selector-face"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDate, formatDateRange } from "@/lib/format/dates"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  presetPeriod,
  RECORDS_PERIOD_PRESETS,
  type RecordsPeriod,
} from "@/plugins/social-media/components/records-filters"

/** The WCA's first competitions, so the calendar never pages back further. */
const FIRST_MONTH = new Date(2003, 0)

function periodLabel({ from, to }: RecordsPeriod): string {
  if (from === null) return to === null ? "All time" : `Until ${formatDate(to)}`
  if (to !== null) return formatDateRange(from, to)
  const preset = RECORDS_PERIOD_PRESETS.find(
    (candidate) => from === presetPeriod(candidate.days).from
  )
  return preset?.label ?? `Since ${formatDate(from)}`
}

function toDateRange(period: RecordsPeriod): DateRange | undefined {
  if (period.from === null) return undefined
  return {
    from: parseISO(period.from),
    to: period.to === null ? undefined : parseISO(period.to),
  }
}

export function RecordsPeriodFilter({
  value,
  onChange,
}: {
  value: RecordsPeriod
  onChange: (period: RecordsPeriod) => void
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const range = toDateRange(value)

  const choose = (period: RecordsPeriod) => {
    onChange(period)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SelectorButton aria-label="Period">
          <SelectorFace.Root>
            <CalendarIcon />
            <SelectorFace.Text>{periodLabel(value)}</SelectorFace.Text>
          </SelectorFace.Root>
        </SelectorButton>
      </PopoverTrigger>
      <PopoverContent
        className="flex w-auto flex-col gap-2 p-2 md:flex-row"
        align="start"
      >
        <div className="flex flex-wrap gap-1 md:flex-col">
          {RECORDS_PERIOD_PRESETS.map((preset) => (
            <Button
              key={preset.days}
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => {
                choose(presetPeriod(preset.days))
              }}
            >
              {preset.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              choose({ from: null, to: null })
            }}
          >
            All time
          </Button>
        </div>
        <Calendar
          mode="range"
          captionLayout="dropdown"
          startMonth={FIRST_MONTH}
          endMonth={new Date()}
          defaultMonth={range?.from}
          selected={range}
          onSelect={(selected) => {
            if (selected?.from === undefined) return
            onChange({
              from: format(selected.from, "yyyy-MM-dd"),
              to:
                selected.to === undefined
                  ? null
                  : format(selected.to, "yyyy-MM-dd"),
            })
          }}
          numberOfMonths={isMobile ? 1 : 2}
        />
      </PopoverContent>
    </Popover>
  )
}
