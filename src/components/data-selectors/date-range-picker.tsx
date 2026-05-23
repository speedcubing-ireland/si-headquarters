"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function toDateRange(
  from: string | null,
  to: string | null
): DateRange | undefined {
  const range = {
    from: from ? parseISO(from) : undefined,
    to: to ? parseISO(to) : undefined,
  }

  return range.from || range.to ? range : undefined
}

function formatDateText(from?: Date, to?: Date) {
  if (!from) return "Pick a date"
  if (!to) return `${format(from, "LLL dd, y")} - Pick end`

  const sameDate = from.getTime() === to.getTime()
  if (sameDate) return format(from, "LLL dd, y")

  const sameYear = from.getFullYear() === to.getFullYear()
  return `${format(from, sameYear ? "LLL dd" : "LLL dd, y")} - ${format(to, "LLL dd, y")}`
}

type DatePickerWithRangeProps = Omit<
  React.ComponentProps<typeof Button>,
  "onChange" | "value"
> & {
  value: {
    from: string | null
    to: string | null
  }
  onChange: (value: {
    from: string | null
    to: string | null
  }) => void | Promise<void>
}

export function DatePickerWithRange({
  onChange,
  value,
  ...props
}: DatePickerWithRangeProps) {
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
    void onChange({
      from: date?.from ? format(date.from, "yyyy-MM-dd") : null,
      to: date?.to ? format(date.to, "yyyy-MM-dd") : null,
    })
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size={props.size || "default"}
          variant={props.variant || "outline"}
          id="date-picker-range"
          {...props}
        >
          <CalendarIcon />
          {formatDateText(displayedDate?.from, displayedDate?.to)}
        </Button>
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
