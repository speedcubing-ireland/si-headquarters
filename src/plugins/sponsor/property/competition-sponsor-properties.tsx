import { HandCoinsIcon, HandshakeIcon, TriangleAlertIcon } from "lucide-react"
import { PageCardRow } from "@/components/page-card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useCan } from "@/features/auth"
import {
  useCompetitionSponsorOverride,
  useCompetitionSponsorPropertyRow,
} from "@/plugins/sponsor/hooks/competition-sponsor-property"
import { useSponsors } from "@/plugins/sponsor/hooks/use-sponsorship"
import {
  competitionPropertyStatusLabel,
  formatEuroFromCents,
} from "@/plugins/sponsor/lib/sponsorship-ui"
import {
  SponsorPropertySelector,
  SponsorPropertyValueFace,
} from "@/plugins/sponsor/property/sponsor-property-selector"

export function SponsorPropertyRow({
  competitionId,
}: {
  competitionId: string
}) {
  const { competitionConvexId, property, isLoading } =
    useCompetitionSponsorPropertyRow(competitionId)
  const { allowed: canManageSponsor } = useCan("access", "SponsorPortalAdmin")
  const { sponsors, isLoading: sponsorsLoading } = useSponsors(canManageSponsor)
  const { setCompetitionSponsorOverride } = useCompetitionSponsorOverride()

  if (isLoading || property === null) {
    return (
      <PageCardRow icon={<HandshakeIcon className="size-4" />} label="Sponsor">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </PageCardRow>
    )
  }

  const displayLabel = competitionPropertyStatusLabel(
    property.status,
    property.winnerSponsorName,
  )

  return (
    <PageCardRow icon={<HandshakeIcon className="size-4" />} label="Sponsor">
      <div className="flex min-w-0 items-center gap-2">
        {property.isManualOverride ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0 text-amber-500">
                <TriangleAlertIcon className="size-4" aria-hidden />
                <span className="sr-only">Manual override</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Manual override</TooltipContent>
          </Tooltip>
        ) : null}
        {canManageSponsor && competitionConvexId !== null ? (
          <SponsorPropertySelector
            disabled={sponsorsLoading}
            displayLabel={displayLabel}
            isManualOverride={property.isManualOverride}
            sponsors={sponsors}
            status={property.status}
            winnerSponsorId={property.winnerSponsorId}
            onChange={(override) =>
              setCompetitionSponsorOverride(competitionConvexId, override)
            }
          />
        ) : (
          <span className="text-sm">
            <SponsorPropertyValueFace
              displayLabel={displayLabel}
              showAuctionIcon={!property.isManualOverride}
            />
          </span>
        )}
      </div>
    </PageCardRow>
  )
}

export function WinningBidPropertyRow({
  competitionId,
}: {
  competitionId: string
}) {
  const { property, isLoading } = useCompetitionSponsorPropertyRow(competitionId)
  const settlementAmountCents = property?.settlementAmountCents

  if (isLoading || settlementAmountCents === undefined) {
    return null
  }

  return (
    <PageCardRow icon={<HandCoinsIcon className="size-4" />} label="Winning Bid">
      <p className="text-sm">{formatEuroFromCents(settlementAmountCents)}</p>
    </PageCardRow>
  )
}
