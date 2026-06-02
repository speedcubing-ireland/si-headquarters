import type { Doc, Id } from "@/convex/_generated/dataModel"
import { SheetTaskIntegrationCard } from "@/plugins/sheets/task-integration-card"

export function PopulateCheckinCard({
  row,
}: {
  row: Doc<"taskIntegrations">
  taskId: Id<"tasks">
}) {
  return (
    <SheetTaskIntegrationCard
      title="Populate check-in sheet"
      row={row}
      onRun={(actions) => {
        void actions.run()
      }}
    />
  )
}
