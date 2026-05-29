import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { NavRoot } from "@/components/layout/layout-navbar"
import { useTaskListPage } from "@/features/tasks/list/use-task-list-page"
import type { SavedViewRecord } from "@/features/tasks/list/use-task-saved-views"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { GlobeIcon, LayersPlus, RotateCcwIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

function SavedViewChip({
  view,
  isActive,
  onSelect,
  onDelete,
}: {
  view: SavedViewRecord
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isPublic = view.visibility === "public"

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onSelect}
            className={cn("h-8 shrink-0 gap-1", isActive && "bg-muted font-medium")}
          >
            {isPublic ? (
              <GlobeIcon className="size-3.5 text-muted-foreground" />
            ) : null}
            {view.name}
          </Button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleteOpen(true)
            }}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete view?</AlertDialogTitle>
            <AlertDialogDescription>
              {isPublic
                ? `This permanently deletes "${view.name}" for everyone with access.`
                : `This permanently deletes your private view "${view.name}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function TaskListNavbar({
  icon: Icon,
  title,
  actions,
}: {
  icon: LucideIcon
  title: string
  actions?: ReactNode
}) {
  const {
    savedViews,
    resetAll,
    setCreateViewOpen,
    activeViewId,
    isDirty,
    hasActiveFilters,
  } = useTaskListPage()

  const showReset = isDirty || hasActiveFilters

  return (
    <NavRoot flush>
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <h1 className="truncate font-heading text-base font-semibold leading-none">
          {title}
        </h1>
      </div>
      {showReset ? (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="h-8 shrink-0 gap-1 text-muted-foreground"
          onClick={resetAll}
        >
          <RotateCcwIcon className="size-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      ) : null}
      {savedViews.views.length > 0 ? (
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {savedViews.views.map((view) => (
            <SavedViewChip
              key={view._id}
              view={view}
              isActive={activeViewId === view._id}
              onSelect={() => {
                savedViews.applyView(view)
              }}
              onDelete={() => {
                void savedViews.deleteView(view._id)
              }}
            />
          ))}
        </div>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        type="button"
        title="New view"
        className={cn(
          "h-8 shrink-0 gap-1",
          savedViews.views.length === 0 && "px-2.5"
        )}
        onClick={() => {
          setCreateViewOpen(true)
        }}
      >
        <LayersPlus className="size-4" />
        <span
          className={
            savedViews.views.length === 0 ? "inline" : "hidden sm:inline"
          }
        >
          New view
        </span>
      </Button>
      {actions !== undefined && actions !== null ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </NavRoot>
  )
}
