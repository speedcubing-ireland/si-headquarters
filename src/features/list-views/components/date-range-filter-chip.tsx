import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import type { DateRangeFilter } from "@/features/list-views/types"
import { CalendarIcon, Lock, X } from "lucide-react"

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
  readOnly,
}: {
  label: string
  dateRange: DateRangeFilter
  onClear?: () => void
  onToggleIsNot?: () => void
  readOnly?: boolean
}) {
  if (readOnly === true) {
    return (
      <ButtonGroup>
        <Button
          variant="outline"
          size="xs"
          type="button"
          disabled
          className="text-muted-foreground"
        >
          <Lock className="size-3" />
          <CalendarIcon className="size-4" />
          {label}
        </Button>
        <ButtonGroupSeparator orientation="vertical" />
        <Button
          variant="outline"
          size="xs"
          type="button"
          disabled
          className="text-muted-foreground"
        >
          {dateRange.isNot === true ? "is not" : "is"}
        </Button>
        <ButtonGroupSeparator orientation="vertical" />
        <Button
          variant="outline"
          size="xs"
          type="button"
          disabled
          className="text-muted-foreground"
        >
          {formatRange(dateRange)}
        </Button>
      </ButtonGroup>
    )
  }

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
