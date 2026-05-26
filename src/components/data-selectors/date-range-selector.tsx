"use client"

import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import * as React from "react"
import type { DateRange } from "react-day-picker"
import { SelectorButton } from "./selector-face"
import * as SelectorFace from "./selector-face"
import type { SelectorChangeHandler } from "./selector-options"

interface DateRangeSelectorValue {
  from: string | null
  to: string | null
}

interface DateRangeSelectorProps
  extends Omit<React.ComponentProps<typeof SelectorButton>, "children" | "onChange" | "value"> {
  value: DateRangeSelectorValue
  onChange: SelectorChangeHandler<DateRangeSelectorValue>
}

function toDateRange(
  from: string | null,
  to: string | null
): DateRange | undefined {
  const range = {
    from: from !== null ? parseISO(from) : undefined,
    to: to !== null ? parseISO(to) : undefined,
  }

  return range.from !== undefined || range.to !== undefined ? range : undefined
}

function formatDateText(from?: Date, to?: Date) {
  if (!from) return "Pick a date"
  if (!to) return `${format(from, "LLL dd, y")} - Pick end`

  const sameDate = from.getTime() === to.getTime()
  if (sameDate) return format(from, "LLL dd, y")

  const sameYear = from.getFullYear() === to.getFullYear()
  return `${format(from, sameYear ? "LLL dd" : "LLL dd, y")} - ${format(
    to,
    "LLL dd, y"
  )}`
}

export function Face({ range }: { range: DateRange | undefined }) {
  return (
    <SelectorFace.Root>
      <CalendarIcon />
      <SelectorFace.Text>
        {formatDateText(range?.from, range?.to)}
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
