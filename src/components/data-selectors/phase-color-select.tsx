import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dot } from "@/components/data-selectors/phase-selector"
import {
  isPhaseColor,
  PHASE_COLORS,
  type PhaseColor,
} from "@/convex/phases/colors"

export function PhaseColorSelect({
  value,
  onChange,
  id,
  disabled,
  className,
}: {
  value: PhaseColor
  onChange: (color: PhaseColor) => void
  id?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (isPhaseColor(next)) {
          onChange(next)
        }
      }}
    >
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PHASE_COLORS.map((color) => (
          <SelectItem key={color} value={color}>
            <span className="flex items-center gap-2 capitalize">
              <Dot className="size-2.5" color={color} />
              {color}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
