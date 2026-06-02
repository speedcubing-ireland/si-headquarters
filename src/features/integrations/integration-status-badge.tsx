import { Badge } from "@/components/ui/badge"
import type { TaskIntegrationStatus } from "@/convex/plugins/core/types"
import { cn } from "@/lib/utils"

const STATUS_LABELS = {
  idle: "Idle",
  running: "Running",
  awaiting_manual_share: "Manual step",
  awaiting_manual_events_confirmation: "Confirm on WCA",
  completed: "Completed",
  error: "Error",
} as const satisfies Record<TaskIntegrationStatus, string>

export function IntegrationStatusBadge({
  status,
  className,
}: {
  status: TaskIntegrationStatus
  className?: string
}) {
  const variant =
    status === "error"
      ? "destructive"
      : status === "completed"
        ? "default"
        : status === "running"
          ? "secondary"
          : "outline"

  return (
    <Badge variant={variant} className={cn("text-sm", className)}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
