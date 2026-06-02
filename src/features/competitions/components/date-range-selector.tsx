"use client"

import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SelectorButton } from "@/components/data-selectors/selector-face"
import * as SelectorFace from "@/components/data-selectors/selector-face"
import type { SelectorChangeHandler } from "@/components/data-selectors/selector-options"
import {
  formatCompetitionDateRangeText,
  toDateRange,
  type CompetitionDateRangeValue,
} from "@/features/competitions/competition-date-range-display"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import * as React from "react"
import type { DateRange } from "react-day-picker"

interface DateRangeSelectorProps extends Omit<
  React.ComponentProps<typeof SelectorButton>,
  "children" | "onChange" | "value"
> {
  value: CompetitionDateRangeValue
  onChange: SelectorChangeHandler<CompetitionDateRangeValue>
}

export function Face({ range }: { range: DateRange | undefined }) {
  return (
    <SelectorFace.Root>
      <CalendarIcon />
      <SelectorFace.Text>
        {formatCompetitionDateRangeText(range?.from, range?.to)}
      </SelectorFace.Text>
    </SelectorFace.Root>
  )
}

export function Button({
  onChange,
  value,
  variant,
  ...props
}: DateRangeSelectorProps) {
  const selectedRange = toDateRange(value.from, value.to)
  const [isOpen, setIsOpen] = React.useState(false)
  const [pickerDate, setPickerDate] = React.useState(selectedRange)
  const displayedDate = isOpen ? pickerDate : selectedRange

  const setOpen = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      setPickerDate(selectedRange)
    }
  }

  const setDate = (date: DateRange | undefined) => {
    setPickerDate(date)
    onChange({
      from: date?.from ? format(date.from, "yyyy-MM-dd") : null,
      to: date?.to ? format(date.to, "yyyy-MM-dd") : null,
    })
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SelectorButton
          id="date-picker-range"
          size={props.size ?? "default"}
          variant={variant}
          {...props}
        >
          <Face range={displayedDate} />
        </SelectorButton>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={pickerDate?.from}
          selected={pickerDate}
          onSelect={setDate}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
