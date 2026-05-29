import { Button } from "@/components/ui/button"
import { formatCompetitionShortcut } from "@/features/competitions/competition-shortcut"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"

export function TaskCompLink({
  row,
  className,
}: {
  row: Pick<
    TaskBoardRow,
    "competitionId" | "competitionName" | "competitionYear"
  >
  className?: string
}) {
  if (row.competitionId === null || row.competitionName === null) {
    return (
      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center text-xs text-muted-foreground",
          className
        )}
        aria-hidden
      >
        —
      </span>
    )
  }

  const label = formatCompetitionShortcut(
    row.competitionName,
    row.competitionYear
  )

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "h-7 shrink-0 px-1.5 font-mono text-[11px] font-semibold tracking-tight whitespace-nowrap",
        className
      )}
      asChild
    >
      <Link
        to="/competitions/$id"
        params={{ id: row.competitionId }}
        title={row.competitionName}
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        {label.length > 0 ? label : "Comp"}
      </Link>
    </Button>
  )
}
