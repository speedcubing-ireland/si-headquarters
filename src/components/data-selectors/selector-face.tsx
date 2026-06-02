import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ComponentProps, ElementType, ReactNode } from "react"
import { SELECTOR_ICON_BUTTON_CLASS } from "./selector-layout"

export type SelectorButtonProps = ComponentProps<typeof Button> & {
  iconOnly?: boolean
}

export function SelectorButton({
  className,
  iconOnly = false,
  size,
  variant = "outline",
  ...props
}: SelectorButtonProps) {
  return (
    <Button
      variant={variant}
      size={iconOnly ? "default" : size}
      data-icon-only={iconOnly ? "" : undefined}
      className={cn(
        "min-w-0",
        iconOnly ? SELECTOR_ICON_BUTTON_CLASS : "justify-start",
        className
      )}
      {...props}
    />
  )
}

export function Root({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      data-slot="selector-face"
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
    >
      {children}
    </span>
  )
}

export function Text({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={cn("truncate", className)}>{children}</span>
}

export function Badges({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      {children}
    </span>
  )
}

export function Empty({
  children,
  className,
  icon: Icon,
}: {
  children: ReactNode
  className?: string
  icon?: ElementType
}) {
  return (
    <Root className={className}>
      {Icon !== undefined && <Icon />}
      <Text>{children}</Text>
    </Root>
  )
}
