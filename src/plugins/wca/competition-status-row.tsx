import { useAction, useQuery } from "convex/react"
import { GlobeIcon, RefreshCwIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PageCardRow } from "@/components/page-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { unknownErrorMessage } from "@/convex/integrations/errorPayload"
import { WCA_MILESTONE_LABELS } from "@/convex/phases/wcaMilestones"
import { formatDateTime } from "@/lib/format/dates"

/**
 * What the WCA last said about this competition, and a manual sync. The phase
 * itself advances automatically; this row exists so it is clear *why* it moved,
 * and so a freshly linked competition can be pulled in without waiting an hour.
 */
export function WcaCompetitionStatusRow({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const status = useQuery(api.plugins.wca.statusQueries.getForCompetition, {
    competitionId,
  })
  const syncNow = useAction(api.plugins.wca.resources.syncCompetitionStatus)
  const [syncing, setSyncing] = useState(false)

  // Not linked to the WCA — nothing to say.
  if (status === undefined || status === null) {
    return null
  }

  const furthest = status.reached.at(-1) ?? null

  const sync = async () => {
    setSyncing(true)
    try {
      await syncNow({ competitionId })
      toast.success("Synced with the WCA.")
    } catch (error) {
      toast.error(unknownErrorMessage(error, { includeConvexError: true }))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <PageCardRow icon={<GlobeIcon className="size-4" />} label="WCA status">
      <div className="flex items-center gap-2">
        {status.cancelled ? (
          <Badge variant="destructive">Cancelled</Badge>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm text-muted-foreground">
              {furthest === null
                ? "Not synced yet"
                : WCA_MILESTONE_LABELS[furthest]}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {status.fetchedAt === null
              ? "This competition has not been synced with the WCA yet."
              : `Last synced ${formatDateTime(status.fetchedAt)}.`}
            {status.unmapped.length > 0
              ? ` No phase is mapped to ${status.unmapped
                  .map((milestone) => WCA_MILESTONE_LABELS[milestone])
                  .join(", ")}, so the phase cannot advance on it.`
              : ""}
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sync with the WCA"
          disabled={syncing}
          onClick={() => void sync()}
        >
          {syncing ? <Spinner /> : <RefreshCwIcon className="size-4" />}
        </Button>
      </div>
    </PageCardRow>
  )
}
