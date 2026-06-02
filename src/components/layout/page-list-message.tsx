import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export function PageListMessage({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "w-full rounded-md border border-dashed bg-card/75 px-3 py-6 text-center text-sm text-balance text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}
