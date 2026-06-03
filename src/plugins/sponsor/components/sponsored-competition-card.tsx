import { Link } from "@tanstack/react-router"
import { ArrowRight, Calendar } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatDateRange } from "@/plugins/sponsor/components/competition-summary-format"
import {
  sponsorshipLifecycleBadgeVariant,
  sponsorshipLifecycleStatusText,
  type SponsorshipLifecycle,
} from "@/plugins/sponsor/lib/sponsorship-ui"

export interface SponsoredCompetitionCardProps {
  competitionName: string
  competitionSummary: Parameters<typeof formatDateRange>[0]
  lifecycle: SponsorshipLifecycle
  managementAuctionId: string
}

function competitionInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase()
}

function lifecycleBadgeClassName(lifecycle: SponsorshipLifecycle): string {
  switch (lifecycle) {
    case "upcoming":
      return "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-500"
    case "ongoing":
      return "bg-primary/10 text-primary border-primary/20"
    case "completed":
      return "bg-muted/80 text-muted-foreground border-border"
  }
}

export function SponsoredCompetitionCard({
  competitionName,
  competitionSummary,
  lifecycle,
  managementAuctionId,
}: SponsoredCompetitionCardProps) {
  const eventDates = formatDateRange(competitionSummary)
  const statusText = sponsorshipLifecycleStatusText(
    lifecycle,
    competitionSummary.startDate
  )

  return (
    <Link
      to="/sponsor/auctions/$auctionId"
      params={{ auctionId: managementAuctionId }}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card
        className={cn(
          "group relative cursor-pointer overflow-hidden py-0 transition-all duration-300",
          "hover:border-green-500/50 hover:bg-muted/50"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-10 shrink-0 border-2 border-background shadow-sm">
              <AvatarFallback className="bg-linear-to-br from-green-400 to-emerald-700 text-sm font-bold text-white">
                {competitionInitials(competitionName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-base leading-snug font-semibold">
                  {competitionName}
                </p>
                <Badge
                  variant={sponsorshipLifecycleBadgeVariant(lifecycle)}
                  className={cn(
                    "shrink-0",
                    lifecycleBadgeClassName(lifecycle)
                  )}
                >
                  {statusText}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="size-4 shrink-0" aria-hidden />
            <span>{eventDates}</span>
          </div>

          <div className="mt-4 flex justify-end">
            <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-green-600 dark:group-hover:text-green-500">
              View auction
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
