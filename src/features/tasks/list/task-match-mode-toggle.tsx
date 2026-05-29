import { Button } from "@/components/ui/button"
import { useTaskListPage } from "@/features/tasks/list/task-list-context"

export function TaskMatchModeToggle() {
  const { matchMode, setMatchMode, showMatchModeToggle } = useTaskListPage()

  if (!showMatchModeToggle) {
    return null
  }

  const nextMode = matchMode === "any" ? "all" : "any"
  const label =
    matchMode === "any"
      ? { short: "Any filter", long: "Match any filter" }
      : { short: "All filters", long: "Match all filters" }

  return (
    <Button
      variant="outline"
      size="xs"
      type="button"
      title={
        matchMode === "any"
          ? "Items matching any active filter type are shown. Click to require all filter types."
          : "Items must match every active filter type. Click to match any filter type."
      }
      onClick={() => {
        setMatchMode(nextMode)
      }}
    >
      <span className="sm:hidden">{label.short}</span>
      <span className="hidden sm:inline">{label.long}</span>
    </Button>
  )
}
