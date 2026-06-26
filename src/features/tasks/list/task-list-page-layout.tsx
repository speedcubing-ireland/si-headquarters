import { Page } from "@/components/layout/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTaskListPage } from "@/features/tasks/list/task-list-context"
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
    <Page.Root>
      {header}
      {createViewOpen ? (
        <Page.Toolbar className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-3 @sm/main:flex-row @sm/main:items-start @sm/main:gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Input
                placeholder="View name"
                value={createViewName}
                onChange={(event) => {
                  setCreateViewName(event.target.value)
                }}
                className="h-8 text-sm font-medium"
              />
              <Textarea
                placeholder="Description (optional)"
                value={createViewDescription}
                onChange={(event) => {
                  setCreateViewDescription(event.target.value)
                }}
                className="min-h-[60px] resize-none text-sm"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2 self-end @sm/main:self-auto">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setCreateViewOpen(false)
                }}
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
          <div className="flex w-full flex-col gap-2 @sm/main:flex-row @sm/main:items-center">
            {filtersRow}
          </div>
        </Page.Toolbar>
      ) : (
        <Page.Toolbar className="flex min-h-12 items-center">
          <div className="flex min-h-12 w-full flex-wrap items-center gap-2 py-2">
            {filtersRow}
          </div>
        </Page.Toolbar>
      )}
      <Page.Content>{children}</Page.Content>
    </Page.Root>
  )
}
