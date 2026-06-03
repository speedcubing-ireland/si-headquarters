import type { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import type { FunctionReturnType } from "convex/server"
import { LoaderCircleIcon } from "lucide-react"

export type CompetitionTemplatePreview = FunctionReturnType<
  typeof api.templates.queries.previewCompetitionTemplate
>

export function TemplatePreviewPanel({
  className,
  preview,
}: {
  className?: string
  preview: CompetitionTemplatePreview | undefined
}) {
  if (preview === undefined) {
    return (
      <div className={cn("rounded-lg border p-3 text-sm", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Previewing template
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg border p-3 text-sm", className)}>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <span>{preview.counts.phases} phases</span>
        <span>{preview.counts.tasks} tasks</span>
        <span>{preview.counts.integrations} integrations</span>
      </div>
      <div className="grid gap-1">
        {preview.phases.map((phase) => (
          <div key={phase.key} className="flex items-center justify-between gap-3">
            <span className="truncate">
              {phase.name}
              {phase.isInitial ? " (initial)" : ""}
            </span>
            <span className="text-muted-foreground">
              {phase.tasks.length} tasks
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
