import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

const PAGE_LIST_MESSAGE_CLASS =
  "m-3 px-4 py-10 text-center text-sm text-muted-foreground @sm/main:m-4"

export function PageListMessage({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn(PAGE_LIST_MESSAGE_CLASS, className)}>{children}</Card>
  )
}
