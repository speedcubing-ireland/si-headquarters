"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function formatDateText(from?: Date, to?: Date) {
  if (!from || !to) return "Pick a date";
  
  const sameDate = from === to;
  if (sameDate) return format(from, "LLL dd, y")
  
  const sameYear = from.getFullYear() === to.getFullYear();
  return `${format(from, sameYear ? "LLL dd" : "LLL dd, y")} - ${format(to, "LLL dd, y")}`;
}

export function DatePickerWithRange({ ...props }:
  React.ComponentProps<typeof Button>) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 20),
    to: addDays(new Date(new Date().getFullYear(), 0, 20), 20),
  })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size={props.size || "default"}
          variant={props.variant || "outline"}
          id="date-picker-range"
        >
          <CalendarIcon />
          {formatDateText(date?.from, date?.to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={setDate}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
