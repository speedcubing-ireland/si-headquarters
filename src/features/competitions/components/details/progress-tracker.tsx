import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const DEMO_DETAILS = {
  name: "My Cool Task",
  description: "This is an example task used for development",
  phase: "Pre-Launch",
  progress: {
    phaseTaskCount: 15,
    done: 7,
    inProgress: 3,
    blocked: 1,
    completionPercent: Math.round((100 * 7) / 15),
  },
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

export function ProgressTracker() {
  // TODO: This needs to be implemented after tasks
  const { progress } = DEMO_DETAILS

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <Badge variant="outline">Pre-Announcement</Badge>
        <span className="font-medium">
          {progress.completionPercent}% complete
        </span>
      </div>
      <div
        aria-label={`${String(progress.done)} done, ${String(progress.inProgress)} in progress, ${String(progress.blocked)} blocked out of ${String(progress.phaseTaskCount)} total`}
        aria-valuemax={progress.phaseTaskCount}
        aria-valuemin={0}
        aria-valuenow={progress.done + progress.inProgress + progress.blocked}
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <ProgressSegment
          className="bg-primary"
          count={progress.done}
          total={progress.phaseTaskCount}
        />
        <ProgressSegment
          className="bg-yellow-500"
          count={progress.inProgress}
          total={progress.phaseTaskCount}
        />
        <ProgressSegment
          className="bg-destructive"
          count={progress.blocked}
          total={progress.phaseTaskCount}
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
          <span className="font-medium text-foreground">
            {progress.phaseTaskCount}
          </span>{" "}
          total
        </span>
        {progress.blocked > 0 && (
          <span className="text-destructive">
            <span className="font-medium">{progress.blocked}</span> blocked
          </span>
        )}
      </div>
    </div>
  )
}
