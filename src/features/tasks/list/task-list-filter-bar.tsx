import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { DisplayMenu } from "@/features/list-views/components/display-menu"
import type { DisplayColumnOption } from "@/features/list-views/components/display-menu"
import { TaskMatchModeToggle } from "@/features/tasks/list/task-match-mode-toggle"
import { useTaskListPage } from "@/features/tasks/list/task-list-context"
import type { ReactNode } from "react"

export function TaskListFilterBar({
  filterPopover,
  filterChips,
  columnOptions,
}: {
  filterPopover: ReactNode
  filterChips: ReactNode
  columnOptions: DisplayColumnOption[]
}) {
  const {
    display,
    setDisplay,
    isDirty,
    activeViewId,
    savedViews,
    createViewPublic,
    setCreateViewPublic,
    createViewOpen,
    hasActiveFilters,
  } = useTaskListPage()

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">{filterPopover}</div>
      {hasActiveFilters ? (
        <div className="order-3 flex min-w-0 basis-full flex-wrap items-center gap-2 sm:order-none sm:basis-auto sm:flex-1">
          {filterChips}
          <TaskMatchModeToggle />
        </div>
      ) : null}
      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
        {createViewOpen ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="create-view-public"
              checked={createViewPublic}
              onCheckedChange={(checked) => {
                setCreateViewPublic(checked === true)
              }}
            />
            <Label htmlFor="create-view-public" className="text-sm">
              Public view
            </Label>
          </div>
        ) : null}
        <DisplayMenu
          display={display}
          columnOptions={columnOptions}
          onChange={setDisplay}
        />
        {isDirty && activeViewId ? (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              void savedViews.saveActiveView()
            }}
          >
            Save view
          </Button>
        ) : null}
      </div>
    </>
  )
}
