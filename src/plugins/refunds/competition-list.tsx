import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  CompetitionRefundSummary,
  RefundComputationResult,
  RefundVolunteerMatch,
} from "@/convex/plugins/refunds/api"
import { formatDateRange } from "@/lib/format/dates"

const STATUS_CONFIG: Record<
  CompetitionRefundSummary["status"],
  { label: string; variant: "destructive" | "secondary" | "outline" }
> = {
  refund_due: { label: "Refund due", variant: "destructive" },
  already_refunded: { label: "Refunded", variant: "secondary" },
  no_eligible_volunteer: { label: "No volunteer", variant: "outline" },
}

function VolunteerMatchCard({ match }: { match: RefundVolunteerMatch }) {
  const hasUnpaid = match.unpaidFirstNames.length > 0

  const renderBadges = (
    names: string[],
    comments: string[],
    adminComments: string[],
    prefix: string,
    highlightDue: boolean
  ) =>
    names.map((name, index) => {
      const comment = comments[index]?.trim() || "No comment"
      const adminComment = adminComments[index]?.trim()
      const isDue =
        highlightDue &&
        match.status === "refund_due" &&
        match.dueRegistrationFirstName === name &&
        match.dueRegistrationId !== null

      const badge = (
        <Badge variant={isDue ? "destructive" : "secondary"}>
          {prefix}: {name}
        </Badge>
      )

      const tooltipContent = (
        <div className="whitespace-pre-line">
          {comment}
          {adminComment && `\nAdmin: ${adminComment}`}
        </div>
      )

      const key = `${prefix}-${name}-${String(index)}`

      const trigger = isDue ? (
        <a
          href={match.dueRegistrationEditUrl ?? ""}
          target="_blank"
          rel="noreferrer"
        >
          {badge}
        </a>
      ) : (
        badge
      )
      return (
        <Tooltip key={key}>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
      )
    })

  return (
    <div className="rounded border px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium whitespace-nowrap">{match.name}</p>
        <div className="flex flex-wrap gap-1">
          {renderBadges(
            match.unpaidFirstNames,
            match.unpaidComments,
            match.unpaidAdminComments,
            "Refunded",
            false
          )}
          {renderBadges(
            match.paidFirstNames,
            match.paidComments,
            match.paidAdminComments,
            "Paid",
            !hasUnpaid
          )}
        </div>
      </div>
    </div>
  )
}

export function CompetitionCard({
  competition,
}: {
  competition: CompetitionRefundSummary
}) {
  const statusConfig = STATUS_CONFIG[competition.status]
  const meta =
    formatDateRange(competition.startDate, competition.endDate) ||
    "Dates unavailable"

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <a
            href={competition.wcaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold hover:underline"
          >
            {competition.competitionName}
            <ExternalLink className="size-3.5" />
          </a>
        </CardTitle>
        <CardDescription>
          {meta} · {competition.registrationCount} registrations ·{" "}
          {competition.acceptedRegistrationCount} accepted
        </CardDescription>
        <CardAction>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {competition.error !== null && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="size-3.5" />
            {competition.error}
          </div>
        )}

        {competition.volunteerMatches.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Volunteer matches
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {competition.volunteerMatches.map((match) => (
                <VolunteerMatchCard key={match.volunteerId} match={match} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No volunteers from your list were accepted at this competition.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function CompetitionList({
  analysis,
  isLoading,
  error,
}: {
  analysis: RefundComputationResult | null
  isLoading: boolean
  error: string | null
}) {
  if (error !== null) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Refund analysis unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading refund analysis...
        </CardContent>
      </Card>
    )
  }

  if (!analysis || analysis.competitions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No competitions found in the analysis window.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {analysis.competitions.map((competition) => (
        <CompetitionCard
          key={competition.competitionId}
          competition={competition}
        />
      ))}
    </div>
  )
}
