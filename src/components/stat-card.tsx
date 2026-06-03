import type { ReactNode } from "react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { STAT_CARD_EMPHASIS_CLASS } from "@/lib/theme-constants"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  description,
  emphasis,
  valueClassName,
}: {
  label: string
  value: ReactNode
  description: string
  emphasis?: boolean
  valueClassName?: string
}) {
  return (
    <Card className={emphasis === true ? STAT_CARD_EMPHASIS_CLASS : undefined}>
      <CardHeader className="gap-1 pb-3">
        <CardDescription className="text-xs font-medium tracking-wide uppercase">
          {label}
        </CardDescription>
        <CardTitle className={cn("text-3xl tabular-nums", valueClassName)}>
          {value}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
    </Card>
  )
}
