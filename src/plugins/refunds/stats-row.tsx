import { Loader2 } from "lucide-react"
import { formatDateRange } from "@/lib/format/dates"
import { Badge } from "@/components/ui/badge"

interface Stats {
  total: number
  refundDue: number
  alreadyRefunded: number
  noEligible: number
  totalVolunteers: number
}

export function StatsRow({
  periodStartDate,
  periodEndDate,
  stats,
  isLoading,
}: {
  periodStartDate?: string
  periodEndDate?: string
  stats: Stats
  isLoading: boolean
}) {
  const periodLabel =
    periodStartDate !== undefined && periodEndDate !== undefined
      ? formatDateRange(periodStartDate, periodEndDate)
      : null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          {periodLabel !== null && (
            <span className="text-sm text-muted-foreground">{periodLabel}</span>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{stats.total} competitions</Badge>
            {stats.refundDue > 0 && (
              <Badge variant="destructive">{stats.refundDue} refund due</Badge>
            )}
            {stats.alreadyRefunded > 0 && (
              <Badge variant="secondary">
                {stats.alreadyRefunded} refunded
              </Badge>
            )}
          </div>
        </>
      )}
    </div>
  )
}
