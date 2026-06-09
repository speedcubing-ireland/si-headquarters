import { Badge } from "@/components/ui/badge"
import type { TaskIntegrationStatus } from "@/convex/integrations/taskIntegrations/validators"
import { cn } from "@/lib/utils"

const STATUS_LABELS = {
  idle: "Idle",
  running: "Running",
  awaiting_manual_share: "Manual step",
  awaiting_manual_events_confirmation: "Manual confirmation",
  completed: "Completed",
  error: "Error",
} as const satisfies Record<TaskIntegrationStatus, string>

export function IntegrationStatusBadge({
  status,
  label,
  className,
}: {
  status: TaskIntegrationStatus
  label?: string
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
      {label ?? STATUS_LABELS[status]}
    </Badge>
  )
}
