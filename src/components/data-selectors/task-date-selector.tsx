import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"
import { SelectorButton } from "./selector-face"
import * as SelectorFace from "./selector-face"
import type { SelectorChangeHandler } from "./selector-options"

interface TaskDateSelectorProps extends Omit<
  ComponentProps<typeof SelectorButton>,
  "children" | "onChange" | "value"
> {
  value: string | null
  onChange: SelectorChangeHandler<string | null>
}

function toDate(value: string | null) {
  return value !== null ? parseISO(value) : undefined
}

function formatDateText(value: string | null) {
  return value !== null ? format(parseISO(value), "MMM dd") : "Set Due"
}

export function Face({
  showIcon,
  value,
}: {
  showIcon: boolean
  value: string | null
}) {
  return (
    <SelectorFace.Root>
      {showIcon && <CalendarIcon />}
      <SelectorFace.Text>{formatDateText(value)}</SelectorFace.Text>
    </SelectorFace.Root>
  )
}

function TaskDateSelectorControl({
  onChange,
  showIcon,
  value,
  variant,
  ...props
}: TaskDateSelectorProps & {
  showIcon: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SelectorButton variant={variant} {...props}>
          <Face showIcon={showIcon} value={value} />
        </SelectorButton>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={toDate(value)}
          onSelect={(date) => {
            onChange(date !== undefined ? format(date, "yyyy-MM-dd") : null)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export function PropertyButton(props: TaskDateSelectorProps) {
  return <TaskDateSelectorControl showIcon {...props} />
}

export function CompactButton({
  size = "sm",
  ...props
}: TaskDateSelectorProps) {
  return <TaskDateSelectorControl showIcon size={size} {...props} />
}

export function InlineTextButton({
  variant = "icon",
  ...props
}: TaskDateSelectorProps) {
  return (
    <TaskDateSelectorControl showIcon={false} variant={variant} {...props} />
  )
}
