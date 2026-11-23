import { useAction, useQuery } from "convex/react"
import { AlertTriangleIcon, GlobeIcon, RefreshCwIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PageCardRow } from "@/components/page-card"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
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
  const relink = useAction(api.plugins.wca.resources.linkCompetition)
  const [syncing, setSyncing] = useState(false)
  const [relinking, setRelinking] = useState(false)

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

  const linkIssue = status.linkIssue
  const candidate = linkIssue?.renameCandidate ?? null

  const relinkToCandidate = async () => {
    if (candidate === null) return
    setRelinking(true)
    try {
      await relink({
        object: { type: "competitions", id: competitionId },
        wcaCompetitionId: candidate.id,
      })
      toast.success(`Linked to ${candidate.name}.`)
    } catch (error) {
      toast.error(unknownErrorMessage(error, { includeConvexError: true }))
    } finally {
      setRelinking(false)
    }
  }

  return (
    <>
      <PageCardRow icon={<GlobeIcon className="size-4" />} label="WCA status">
        <div className="flex items-center gap-2">
          {linkIssue === null ? null : (
            <Badge variant="destructive">Link broken</Badge>
          )}
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
      {linkIssue === null ? null : (
        <Alert variant="destructive" layout="stacked">
          <AlertTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4" />
            WCA competition not found
          </AlertTitle>
          <AlertDescription>
            {linkIssue.mayBeHidden ? (
              <>
                The WCA cannot find <code>{status.wcaCompetitionId}</code>.
                Either the competition was renamed there, which changes its WCA
                ID, or it is not announced yet and the WCA account connected to
                HQ does not manage it, so cannot see it.
              </>
            ) : (
              <>
                <code>{status.wcaCompetitionId}</code> no longer exists on the
                WCA. This usually means the competition was renamed there, which
                changes its WCA ID.
              </>
            )}{" "}
            Until this is fixed, the phase will not follow the WCA.
            {candidate === null ? (
              linkIssue.mayBeHidden ? (
                <>
                  {" "}
                  Remove the WCA link below and link the competition again, or
                  connect a WCA account that manages it.
                </>
              ) : (
                <> Remove the WCA link below and link the competition again.</>
              )
            ) : (
              <>
                {" "}
                It looks like it is now{" "}
                <a href={candidate.url} target="_blank" rel="noreferrer">
                  {candidate.name}
                </a>{" "}
                (<code>{candidate.id}</code>).
              </>
            )}
          </AlertDescription>
          {candidate === null ? null : (
            <AlertAction>
              <Button
                size="sm"
                variant="outline"
                disabled={relinking}
                onClick={() => void relinkToCandidate()}
              >
                {relinking ? <Spinner /> : null}
                Relink to {candidate.id}
              </Button>
            </AlertAction>
          )}
        </Alert>
      )}
    </>
  )
}
