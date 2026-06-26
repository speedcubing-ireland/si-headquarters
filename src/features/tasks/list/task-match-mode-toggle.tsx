import { Button } from "@/components/ui/button"
import { useTaskListPage } from "@/features/tasks/list/task-list-context"

export function TaskMatchModeToggle() {
  const { editMatchMode, setEditMatchMode, showMatchModeToggle } =
    useTaskListPage()

  if (!showMatchModeToggle) {
    return null
  }

  const nextMode = editMatchMode === "any" ? "all" : "any"
  const label =
    editMatchMode === "any"
      ? { short: "Any filter", long: "Match any filter" }
      : { short: "All filters", long: "Match all filters" }

  return (
    <Button
      variant="outline"
      size="xs"
      type="button"
      title={
        editMatchMode === "any"
          ? "Items matching any active filter type are shown. Click to require all filter types."
          : "Items must match every active filter type. Click to match any filter type."
      }
      onClick={() => {
        setEditMatchMode(nextMode)
      }}
    >
      <span className="@sm/main:hidden">{label.short}</span>
      <span className="hidden @sm/main:inline">{label.long}</span>
    </Button>
  )
}
