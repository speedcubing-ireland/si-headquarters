import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ComponentProps, ElementType, ReactNode } from "react"

export type SelectorButtonProps = ComponentProps<typeof Button>

export function SelectorButton({
  className,
  variant = "outline",
  ...props
}: SelectorButtonProps) {
  return (
    <Button
      variant={variant}
      className={cn("min-w-0 justify-start", className)}
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
