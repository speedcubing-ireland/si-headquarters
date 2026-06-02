import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { SheetTaskIntegrationCard } from "@/plugins/sheets/task-integration-card"
import { useState } from "react"

export function TransferScheduleCard({
  row,
}: {
  row: Doc<"taskIntegrations">
  taskId: Id<"tasks">
}) {
  const [overwriteEvents, setOverwriteEvents] = useState(false)
  const output =
    row.output?.kind === "schedule_transfer" ? row.output : undefined

  return (
    <SheetTaskIntegrationCard
      title="Transfer schedule to WCA"
      row={row}
      onRun={(actions) => {
        void actions.run({ overwriteEvents })
      }}
      onConfirm={
        row.status === "awaiting_manual_events_confirmation"
          ? (actions) => {
              void actions.confirmEvents()
            }
          : undefined
      }
      confirmLabel="Confirm WCA upload"
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
    </SheetTaskIntegrationCard>
  )
}
