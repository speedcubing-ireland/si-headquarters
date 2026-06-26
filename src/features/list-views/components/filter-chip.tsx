import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import type { LucideIcon } from "lucide-react"
import { Lock, X } from "lucide-react"
import type { ReactNode } from "react"

export function FilterChip<TValue extends string>({
  icon: Icon,
  label,
  values,
  isNot,
  onToggleIsNot,
  onRemove,
  renderValue,
  wrapValueButton,
  readOnly,
}: {
  icon: LucideIcon
  label: string
  values: TValue[]
  isNot: boolean
  onToggleIsNot: () => void
  onRemove: () => void
  renderValue: (value: TValue) => ReactNode
  wrapValueButton?: (button: React.ReactElement) => ReactNode
  readOnly?: boolean
}) {
  const hasMultiple = values.length > 1
  const isNotText = isNot
    ? hasMultiple
      ? "is none"
      : "is not"
    : hasMultiple
      ? "is any"
      : "is"

  if (readOnly === true) {
    return (
      <ButtonGroup className="text-muted-foreground">
        <Button
          variant="outline"
          size="xs"
          type="button"
          disabled
          className="text-muted-foreground"
        >
          <Lock className="size-3" />
          <Icon className="size-4" />
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
          {isNotText}
        </Button>
        <ButtonGroupSeparator orientation="vertical" />
        <Button
          variant="outline"
          size="xs"
          type="button"
          disabled
          className="min-w-0 text-muted-foreground"
        >
          {values.length === 1 ? (
            renderValue(values[0])
          ) : (
            <span className="truncate">
              {values.length} {label.toLowerCase()}
            </span>
          )}
        </Button>
      </ButtonGroup>
    )
  }

  const valueButton = (
    <Button variant="outline" size="xs" className="min-w-0" type="button">
      {values.length === 1 ? (
        renderValue(values[0])
      ) : (
        <span className="truncate">
          {values.length} {label.toLowerCase()}
        </span>
      )}
    </Button>
  )

  return (
    <ButtonGroup>
      <Button variant="outline" size="xs" type="button">
        <Icon className="size-4" />
        {label}
      </Button>
      <ButtonGroupSeparator orientation="vertical" />
      <Button variant="outline" size="xs" type="button" onClick={onToggleIsNot}>
        {isNotText}
      </Button>
      <ButtonGroupSeparator orientation="vertical" />
      {wrapValueButton ? wrapValueButton(valueButton) : valueButton}
      <ButtonGroupSeparator orientation="vertical" />
      <Button variant="outline" size="icon-xs" type="button" onClick={onRemove}>
        <X />
      </Button>
    </ButtonGroup>
  )
}
