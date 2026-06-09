import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  TaskIntegrationCardShell,
  type TaskIntegrationCardActions,
  type TaskIntegrationCardRow,
} from "@/features/integrations/task-integration-card-shell"
import { isManualIntegrationStatus } from "@/features/integrations/integration-status"
import type { TaskIntegrationStatus } from "@/convex/integrations/taskIntegrations/validators"
import { FileSpreadsheetIcon } from "lucide-react"
import { useState } from "react"

export function TransferScheduleCard({ row }: { row: TaskIntegrationCardRow }) {
  const [overwriteEvents, setOverwriteEvents] = useState(false)
  const output =
    row.output?.kind === "schedule_transfer" ? row.output : undefined

  return (
    <TaskIntegrationCardShell
      icon={<FileSpreadsheetIcon className="size-4 text-lime-500" />}
      row={row}
      statusLabel={
        row.status === "awaiting_manual_events_confirmation"
          ? "Confirm on WCA"
          : undefined
      }
      actions={({ actions, status }) =>
        renderActions({ actions, status, overwriteEvents })
      }
    >
      {row.status === "error" ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`overwrite-${row._id}`}
            checked={overwriteEvents}
            onCheckedChange={(checked) => {
              setOverwriteEvents(checked === true)
            }}
          />
          <Label htmlFor={`overwrite-${row._id}`}>
            Overwrite existing WCA events
          </Label>
        </div>
      ) : null}
      {output?.wcaUrl !== undefined ? (
        <Button
          asChild
          type="button"
          variant="link"
          className="h-auto justify-start p-0"
        >
          <a href={output.wcaUrl} target="_blank" rel="noreferrer">
            Open WCA competition
          </a>
        </Button>
      ) : null}
    </TaskIntegrationCardShell>
  )
}

function renderActions({
  actions,
  overwriteEvents,
  status,
}: {
  actions: TaskIntegrationCardActions
  overwriteEvents: boolean
  status: TaskIntegrationStatus
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={status === "running" || actions.pending === "run"}
        onClick={() => {
          void actions.run({ overwriteEvents })
        }}
      >
        {status === "running" ? "Running..." : "Run"}
      </Button>
      {isManualIntegrationStatus(status) ? (
        <Button
          type="button"
          disabled={actions.pending === "confirm"}
          onClick={() => {
            void actions.confirmManualStep({
              expectedStatus: status,
              completedMessage: "WCA schedule upload confirmed.",
            })
          }}
        >
          Confirm WCA upload
        </Button>
      ) : null}
    </>
  )
}
