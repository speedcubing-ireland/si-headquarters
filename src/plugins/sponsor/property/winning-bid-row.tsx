import { useQuery } from "convex/react"
import { HandCoinsIcon } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { parseCompetitionId } from "@/lib/convex-ids"
import { PageCardRow } from "@/components/page-card"
import { formatEuroFromCents } from "@/plugins/sponsor/lib/sponsorship-ui"
import { isSponsorshipEnabled } from "@/lib/feature-flags"

export function WinningBidPropertyRow({
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
      <PageCardRow
        icon={<HandCoinsIcon className="size-4" />}
        label="Winning Bid"
      >
        <span className="text-sm text-muted-foreground">Loading…</span>
      </PageCardRow>
    )
  }

  const amount =
    status.settlementAmountCents !== undefined
      ? formatEuroFromCents(status.settlementAmountCents)
      : "—"

  return (
    <PageCardRow icon={<HandCoinsIcon className="size-4" />} label="Winning Bid">
      <p>{amount}</p>
    </PageCardRow>
  )
}
