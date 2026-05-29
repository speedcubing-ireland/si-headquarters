import { Button } from "@/components/ui/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group"
import type { DateRangeFilter } from "@/features/list-views/types"
import { CalendarIcon, X } from "lucide-react"

function formatRange(dateRange: DateRangeFilter) {
  const start = dateRange.start ?? "…"
  const end = dateRange.end ?? "…"
  return `${start} – ${end}`
}

export function DateRangeFilterChip({
  label,
  dateRange,
  onClear,
  onToggleIsNot,
}: {
  label: string
  dateRange: DateRangeFilter
  onClear: () => void
  onToggleIsNot: () => void
}) {
  return (
    <ButtonGroup>
      <Button variant="outline" size="xs" type="button">
        <CalendarIcon className="size-4" />
        {label}
      </Button>
      <ButtonGroupSeparator orientation="vertical" />
      <Button variant="outline" size="xs" type="button" onClick={onToggleIsNot}>
        {dateRange.isNot === true ? "is not" : "is"}
      </Button>
      <ButtonGroupSeparator orientation="vertical" />
      <Button variant="outline" size="xs" type="button">
        {formatRange(dateRange)}
      </Button>
      <ButtonGroupSeparator orientation="vertical" />
      <Button variant="outline" size="icon-xs" type="button" onClick={onClear}>
        <X />
      </Button>
    </ButtonGroup>
  )
}
