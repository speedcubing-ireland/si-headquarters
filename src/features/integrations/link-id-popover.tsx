import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SELECTOR_POPOVER_WIDTH } from "@/components/data-selectors/selector-layout"
import { LinkActionShell } from "@/features/integrations/link-action-shell"
import type { ReactNode } from "react"

export function LinkIdPopover({
  icon,
  label,
  submitLabel,
  pendingLabel = "Linking…",
  placeholder,
  value,
  onValueChange,
  canSubmit,
  onSubmit,
  open,
  onOpenChange,
  error,
  pending,
}: {
  icon: ReactNode
  label: string
  submitLabel: string
  pendingLabel?: string
  placeholder: string
  value: string
  onValueChange: (value: string) => void
  canSubmit: boolean
  onSubmit: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
  error: string | null
  pending: boolean
}) {
  return (
    <LinkActionShell error={error}>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" type="button" disabled={pending}>
            {icon}
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className={SELECTOR_POPOVER_WIDTH}>
          <Input
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              onValueChange(e.target.value)
            }}
          />
          <Button
            type="button"
            className="w-full"
            disabled={pending || !canSubmit}
            onClick={onSubmit}
          >
            {pending ? pendingLabel : submitLabel}
          </Button>
        </PopoverContent>
      </Popover>
    </LinkActionShell>
  )
}
