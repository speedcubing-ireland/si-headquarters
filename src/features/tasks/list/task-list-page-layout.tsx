import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTaskListPage } from "@/features/tasks/list/use-task-list-page"
import type { ReactNode } from "react"

export function TaskListPageLayout({
  header,
  filtersRow,
  children,
}: {
  header: ReactNode
  filtersRow: ReactNode
  children: ReactNode
}) {
  const {
    createViewOpen,
    createViewName,
    setCreateViewName,
    createViewDescription,
    setCreateViewDescription,
    handleSaveNewView,
    setCreateViewOpen,
  } = useTaskListPage()

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {header}
      {createViewOpen ? (
        <div className="flex min-h-12 shrink-0 flex-col gap-3 border-b bg-background px-3 py-2 sm:px-4 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Input
                placeholder="View name"
                value={createViewName}
                onChange={(event) => { setCreateViewName(event.target.value); }}
                className="h-8 text-sm font-medium"
              />
              <Textarea
                placeholder="Description (optional)"
                value={createViewDescription}
                onChange={(event) =>
                  { setCreateViewDescription(event.target.value); }
                }
                className="min-h-[60px] resize-none text-sm"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => { setCreateViewOpen(false); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="button"
                disabled={createViewName.trim().length === 0}
                onClick={() => void handleSaveNewView()}
              >
                Save view
              </Button>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            {filtersRow}
          </div>
        </div>
      ) : (
        <div className="flex min-h-12 shrink-0 items-center border-b">
          <div className="flex h-12 w-full flex-wrap items-center gap-2 px-3 sm:px-4 lg:px-6">
            {filtersRow}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
