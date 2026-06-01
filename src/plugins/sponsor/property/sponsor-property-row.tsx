import { useQuery } from "convex/react"
import { GavelIcon, HandshakeIcon } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { parseCompetitionId } from "@/lib/convex-ids"
import { Button } from "@/components/ui/button"
import { PageCardRow } from "@/components/page-card"
import { isSponsorshipEnabled } from "@/lib/feature-flags"

export function SponsorPropertyRow({
  competitionId,
}: {
  competitionId: string
}) {
  const enabled = isSponsorshipEnabled
  const competitionConvexId = parseCompetitionId(competitionId)
  const status = useQuery(
    api.plugins.sponsor.admin.propertyStatus.getForCompetition,
    enabled && competitionConvexId !== null
      ? { competitionId: competitionConvexId }
      : "skip",
  )

  if (!enabled) {
    return null
  }

  if (status === undefined) {
    return (
      <PageCardRow icon={<HandshakeIcon className="size-4" />} label="Sponsor">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </PageCardRow>
    )
  }

  const label =
    status.status === "sponsor"
      ? "Sponsored"
      : status.status === "bidding"
        ? "Bidding"
        : status.status === "not_offered"
          ? "Not offered"
          : "No sponsor"

  return (
    <PageCardRow icon={<HandshakeIcon className="size-4" />} label="Sponsor">
      <Button variant="outline" type="button">
        <GavelIcon />
        {label}
      </Button>
    </PageCardRow>
  )
}
