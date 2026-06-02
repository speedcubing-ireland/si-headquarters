import { Button } from "@/components/ui/button"
import { TaskIntegrationCardShell } from "@/features/integrations/task-integration-card-shell"
import type { TaskIntegrationCardRow } from "@/features/integrations/task-integration-card-shell"
import { FileSpreadsheetIcon } from "lucide-react"

export function SheetRunCard({ row }: { row: TaskIntegrationCardRow }) {
  return (
    <TaskIntegrationCardShell
      icon={<FileSpreadsheetIcon className="size-4 text-lime-500" />}
      row={row}
      actions={({ actions, status }) => (
        <Button
          type="button"
          variant="outline"
          disabled={status === "running" || actions.pending === "run"}
          onClick={() => {
            void actions.run()
          }}
        >
          {status === "running" ? "Running..." : "Run"}
        </Button>
      )}
    />
  )
}
