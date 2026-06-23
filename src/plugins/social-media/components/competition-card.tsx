import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Copy,
  ExternalLink,
  MapPin,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  formatDateRange,
  formatDateTimeInConfiguredTimeZone,
} from "@/lib/format/dates"
import { formatWcaEventLabel, formatWcaEventShortLabel } from "@/lib/wca-events"
import type { SocialMediaDashboardCompetition } from "@/plugins/social-media/use-social-media-dashboard"
import { organisationConfig } from "@/config/lib/organisation"

const VISIBLE_EVENT_COUNT = 4

function hasText(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value.trim().length > 0
}

function buildPostInfo({
  competition,
  dateRange,
  venue,
  address,
  registrationOpen,
}: {
  competition: SocialMediaDashboardCompetition
  dateRange: string
  venue: string | null
  address: string | null
  registrationOpen: string | null
}) {
  return [
    competition.name,
    `Dates: ${dateRange}`,
    venue !== null ? `Venue: ${venue}` : null,
    address !== null ? `Address: ${address}` : null,
    registrationOpen !== null
      ? `Registration opens: ${registrationOpen}`
      : null,
    competition.sponsorLabels.length > 0
      ? `Sponsors: ${competition.sponsorLabels.join(", ")}`
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
}

function MetaItem({
  icon: Icon,
  children,
  emphasis = false,
}: {
  icon: LucideIcon
  children: ReactNode
  emphasis?: boolean
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon
        className={
          emphasis
            ? "mt-0.5 size-4 shrink-0 text-primary"
            : "mt-0.5 size-4 shrink-0 text-muted-foreground"
        }
        aria-hidden
      />
      <span
        className={
          emphasis ? "font-medium text-foreground" : "text-muted-foreground"
        }
      >
        {children}
      </span>
    </div>
  )
}

function EventBadges({ eventIds }: { eventIds: string[] }) {
  if (eventIds.length === 0) {
    return null
  }

  const visibleEventIds = eventIds.slice(0, VISIBLE_EVENT_COUNT)
  const remainingEventIds = eventIds.slice(VISIBLE_EVENT_COUNT)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase">
        Events
      </p>
      <div className="flex flex-wrap gap-1">
        {visibleEventIds.map((eventId) => (
          <Badge key={eventId} variant="outline">
            {formatWcaEventShortLabel(eventId)}
          </Badge>
        ))}
        {remainingEventIds.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                asChild
                variant="secondary"
                className="cursor-help border-border"
              >
                <button type="button">+{remainingEventIds.length} more</button>
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="block max-w-64 leading-relaxed">
              {remainingEventIds.map(formatWcaEventLabel).join(", ")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}

function SponsorBadges({ labels }: { labels: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase">
        Sponsors
      </p>
      <div className="flex flex-wrap gap-1">
        {labels.length > 0 ? (
          labels.map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))
        ) : (
          <Badge variant="secondary">None found</Badge>
        )}
      </div>
    </div>
  )
}

export function CompetitionCard({
  competition,
}: {
  competition: SocialMediaDashboardCompetition
}) {
  const dateRange = formatDateRange(competition.startDate, competition.endDate)
  const venue = hasText(competition.venue) ? competition.venue.trim() : null
  const address = hasText(competition.address)
    ? competition.address.trim()
    : null
  const registrationOpen = hasText(competition.registrationOpen)
    ? formatDateTimeInConfiguredTimeZone(competition.registrationOpen)
    : null

  const copyPostInfo = async () => {
    try {
      await navigator.clipboard.writeText(
        buildPostInfo({
          competition,
          dateRange,
          venue,
          address,
          registrationOpen,
        })
      )
      toast.success("Competition info copied.")
    } catch {
      toast.error("Could not copy competition info.")
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-base leading-tight">
            {competition.hqCompetitionId ? (
              <Link
                to="/competitions/$id"
                params={{ id: competition.hqCompetitionId }}
                className="hover:underline"
              >
                {competition.name}
              </Link>
            ) : (
              competition.name
            )}
          </CardTitle>
          <Button variant="ghost" size="icon-sm" asChild>
            <a
              href={competition.wcaUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${competition.name} on WCA`}
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
        <CardDescription>{dateRange}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-2">
          {venue !== null ? (
            <MetaItem icon={Building2}>{venue}</MetaItem>
          ) : null}
          {address !== null ? (
            <MetaItem icon={MapPin}>{address}</MetaItem>
          ) : null}
          {registrationOpen !== null ? (
            <MetaItem icon={CalendarDays} emphasis>
              Reg opens: {registrationOpen}
            </MetaItem>
          ) : null}
          {competition.competitorLimit !== null ? (
            <MetaItem icon={Users}>
              {competition.competitorLimit} competitor limit
            </MetaItem>
          ) : null}
        </div>
        <EventBadges eventIds={competition.eventIds} />
        <SponsorBadges labels={competition.sponsorLabels} />
      </CardContent>
      <CardFooter className="mt-auto gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-w-0 flex-1"
          onClick={() => {
            void copyPostInfo()
          }}
        >
          <Copy className="size-3.5" />
          Copy info
        </Button>
        {competition.hqCompetitionId !== undefined ? (
          <Button size="sm" className="min-w-0 flex-1" asChild>
            <Link
              to="/competitions/$id"
              params={{ id: competition.hqCompetitionId }}
            >
              Open in {organisationConfig.organisation.productName}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <Button size="sm" className="min-w-0 flex-1" asChild>
            <a
              href={competition.wcaUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open WCA
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
