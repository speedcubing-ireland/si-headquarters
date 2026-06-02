import { Button } from "@/components/ui/button"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  TaskIntegrationCardShell,
  type TaskIntegrationCardActions,
} from "@/features/integrations/task-integration-card-shell"
import { FileSpreadsheetIcon } from "lucide-react"
import type { ReactNode } from "react"

export function SheetTaskIntegrationCard({
  title,
  row,
  confirmLabel,
  manualAlert,
  onRun,
  onConfirm,
  children,
}: {
  title: string
  row: Doc<"taskIntegrations">
  confirmLabel?: string
  manualAlert?: string
  onRun: (actions: TaskIntegrationCardActions) => void
  onConfirm?: (actions: TaskIntegrationCardActions) => void
  children?: ReactNode
}) {
  return (
    <TaskIntegrationCardShell
      icon={<FileSpreadsheetIcon className="size-4 text-lime-500" />}
      title={title}
      row={row}
      renderAlert={() => manualAlert}
      renderActions={({ actions, status }) => (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={status === "running" || actions.pending === "run"}
            onClick={() => {
              onRun(actions)
            }}
          >
            {status === "running" ? "Running…" : "Run"}
          </Button>
          {onConfirm !== undefined ? (
            <Button
              type="button"
              disabled={actions.pending === "confirm"}
              onClick={() => {
                onConfirm(actions)
              }}
            >
              {confirmLabel ?? "Confirm"}
            </Button>
          ) : null}
        </>
      )}
    >
      {children}
    </TaskIntegrationCardShell>
  )
}
