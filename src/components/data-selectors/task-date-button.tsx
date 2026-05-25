import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useState } from "react"

function toDate(value: string | null) {
  return value !== null ? parseISO(value) : undefined
}

function formatDateText(value: string | null) {
  return value !== null ? format(parseISO(value), "MMM dd") : "Pick a date"
}

type TaskDateButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "onChange" | "value"
> & {
  value: string | null
  onChange: (value: string | null) => Promise<null> | undefined
  showIcon?: boolean
}

export function TaskDateButton({
  onChange,
  value,
  showIcon = true,
  ...props
}: TaskDateButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={props.variant ?? "outline"} {...props}>
          {showIcon && <CalendarIcon />}
          {formatDateText(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={toDate(value)}
          onSelect={(date) => {
            void onChange(
              date !== undefined ? format(date, "yyyy-MM-dd") : null
            )
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
