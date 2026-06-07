import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function SponsorMetricLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "text-xs font-medium tracking-wide text-muted-foreground uppercase",
        className
      )}
    >
      {children}
    </p>
  )
}

export function SponsorMetricTile({
  label,
  children,
  className,
  labelIcon,
  valueClassName,
  align = "left",
}: {
  label: ReactNode
  children: ReactNode
  className?: string
  labelIcon?: ReactNode
  valueClassName?: string
  align?: "left" | "right"
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-muted/20 p-3",
        align === "right" && "sm:text-right",
        className
      )}
    >
      <SponsorMetricLabel
        className={
          labelIcon !== undefined ? "flex items-center gap-1.5" : undefined
        }
      >
        {labelIcon}
        {label}
      </SponsorMetricLabel>
      <div className={cn("mt-1 text-sm font-medium", valueClassName)}>
        {children}
      </div>
    </div>
  )
}

export function SponsorMetricDetail({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1">
      <SponsorMetricLabel>{label}</SponsorMetricLabel>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  )
}

export function SponsorMutedPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}
