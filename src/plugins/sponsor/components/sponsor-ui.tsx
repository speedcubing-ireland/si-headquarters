import type { LucideIcon } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function SponsorFeatureIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md border bg-primary/10",
        className
      )}
    >
      <Icon className="size-5 text-primary" aria-hidden />
    </div>
  )
}

export function SponsorPageLoading({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-svh items-center justify-center bg-background",
        className
      )}
    >
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  )
}

export function SponsorInlineLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  )
}

export function SponsorButtonSpinner() {
  return <Spinner className="size-4" />
}
