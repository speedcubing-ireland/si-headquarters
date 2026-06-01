import { Dot } from "@/components/data-selectors/phase-selector"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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

function ProgressSegment({
  className,
  count,
  total,
}: {
  className: string
  count: number
  total: number
}) {
  if (count <= 0 || total <= 0) return null

  return (
    <div
      className={cn("h-full shrink-0", className)}
      style={{ width: `${String((count / total) * 100)}%` }}
    />
  )
}

function ProgressTrackerLoading() {
  return (
    <ProgressTrackerFrame>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-2 w-full shrink-0 rounded-full" />
      <div className="mt-2 flex gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-10" />
      </div>
    </ProgressTrackerFrame>
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
    return <ProgressTrackerLoading />
  }

  const { phase, progress } = data

  return (
    <ProgressTrackerFrame>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        {phase ? (
          <Badge className="gap-1.5 font-normal" variant="outline">
            <Dot className="size-2" color={phase.color} />
            {phase.name}
          </Badge>
        ) : (
          <Badge className="font-normal text-muted-foreground" variant="outline">
            No current phase
          </Badge>
        )}
        <span className="font-medium">
          {progress.completionPercent}% complete
        </span>
      </div>
      <div
        aria-label={
          phase
            ? `${String(progress.done)} done, ${String(progress.inProgress)} in progress, ${String(progress.blocked)} blocked out of ${String(progress.total)} total`
            : "No current phase progress"
        }
        aria-valuemax={progress.total}
        aria-valuemin={0}
        aria-valuenow={
          progress.done + progress.inProgress + progress.blocked
        }
        className="h-2 w-full shrink-0 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <ProgressSegment
          className="bg-primary"
          count={progress.done}
          total={progress.total}
        />
        <ProgressSegment
          className="bg-yellow-500"
          count={progress.inProgress}
          total={progress.total}
        />
        <ProgressSegment
          className="bg-destructive"
          count={progress.blocked}
          total={progress.total}
        />
      </div>
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
      </div>
    </ProgressTrackerFrame>
  )
}
