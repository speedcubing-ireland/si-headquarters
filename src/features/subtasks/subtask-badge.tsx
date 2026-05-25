import { CassetteTapeIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { FlowViewProgress } from "@/convex/tasks/queries"
import type { TaskKind } from "@/convex/tasks/status/resolver"

const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 6

function ProgressIcon({
  done,
  total,
  className,
}: {
  done: number
  total: number
  className?: string
}) {
  return (
    <svg className={cn("size-3", className)} viewBox="0 0 16 16" fill="none">
      <title>Subtask progress</title>
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.3"
      />
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={`${(done / total) * CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`}
        strokeLinecap="round"
        transform="rotate(-90 8 8)"
      />
    </svg>
  )
}

export function SubtaskBadge({
  kind,
  progress,
  className,
}: {
  kind: TaskKind
  progress: FlowViewProgress
  className?: string
}) {
  const subtaskCount = progress.total
  if (subtaskCount === 0) return null

  return (
    <Badge
      variant="outline"
      className={cn("text-sm", className ?? "hidden sm:flex")}
    >
      {kind === "standard" && (
        <ProgressIcon
          done={progress.done}
          total={progress.total}
          data-icon="inline-start"
        />
      )}
      {kind === "flow" && <CassetteTapeIcon data-icon="inline-start" />}
      {`${progress.done}/${progress.total}`}
    </Badge>
  )
}
