import { Dot } from "@/components/data-selectors/phase-selector"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { useQuery } from "convex/react"
import type { ReactNode } from "react"

const PROGRESS_TRACKER_HEIGHT_CLASS = "h-[76px]"

function ProgressTrackerFrame({ children }: { children: ReactNode }) {
  return (
    <div className={cn("flex flex-col", PROGRESS_TRACKER_HEIGHT_CLASS)}>
      {children}
    </div>
  )
}

export function ProgressTracker({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const data = useQuery(api.competitions.queries.getCurrentPhaseProgress, {
    id: competitionId,
  })

  if (data === undefined) {
    return null
  }

  const { phase, progress } = data

  const progressAriaLabel = phase
    ? `${String(progress.done)} done, ${String(progress.inProgress)} in progress, ${String(progress.blocked)} blocked out of ${String(progress.total)} total`
    : "No current phase progress"

  return (
    <ProgressTrackerFrame>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        {phase ? (
          <Badge className="gap-1.5 font-normal" variant="outline">
            <Dot className="size-2" color={phase.color} />
            {phase.name}
          </Badge>
        ) : (
          <Badge
            className="font-normal text-muted-foreground"
            variant="outline"
          >
            No current phase
          </Badge>
        )}
        <span className="font-medium">
          {progress.completionPercent}% complete
        </span>
      </div>
      <Progress
        aria-label={progressAriaLabel}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress.completionPercent}
        aria-valuetext={`${String(progress.completionPercent)}% complete`}
        className="h-2"
        value={progress.completionPercent}
      />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{progress.done}</span>{" "}
          done
        </span>
        <span>
          <span className="font-medium text-foreground">
            {progress.inProgress}
          </span>{" "}
          in progress
        </span>
        <span>
          <span className="font-medium text-foreground">{progress.total}</span>{" "}
          total
        </span>
        {progress.blocked > 0 ? (
          <span className="text-destructive">
            <span className="font-medium">{progress.blocked}</span> blocked
          </span>
        ) : null}
        {progress.cancelled > 0 ? (
          <span>
            <span className="font-medium text-foreground">
              {progress.cancelled}
            </span>{" "}
            cancelled
          </span>
        ) : null}
      </div>
    </ProgressTrackerFrame>
  )
}
