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
import { Page } from "@/components/layout/page"
import { useTaskListPage } from "@/features/tasks/list/task-list-context"
import { TASK_LIST_PRESET_LABELS } from "@/features/tasks/list/task-list-config"
import type { SavedTaskView } from "@/features/tasks/list/use-task-saved-views"
import { GlobeIcon, LayersPlus, PinIcon, UserIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

function SavedViewChip({
  view,
  isActive,
  onSelect,
  onDelete,
}: {
  view: SavedTaskView
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Button
            variant={isActive ? "default" : "outline"}
            size="sm"
            type="button"
            onClick={onSelect}
            className="h-8 shrink-0 gap-1"
            title={
              view.visibility === "public"
                ? "Public shared view"
                : "Personal view"
            }
          >
            {view.visibility === "public" ? (
              <GlobeIcon aria-hidden="true" className="size-3.5" />
            ) : (
              <UserIcon aria-hidden="true" className="size-3.5" />
            )}
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
              {view.visibility === "public"
                ? `This permanently deletes "${view.name}" for everyone with access.`
                : `This permanently deletes your private view "${view.name}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function TaskListNavbar({ actions }: { actions?: ReactNode }) {
  const {
    config,
    savedViews,
    setCreateViewOpen,
    activeViewId,
    activePresetId,
    applyPreset,
  } = useTaskListPage()

  return (
    <Page.Header>
      <Page.Title>{config.title}</Page.Title>
      <div className="flex min-w-0 flex-1 scrollbar-none items-center gap-1 overflow-x-auto @sm/main:flex-wrap @sm/main:overflow-visible [&::-webkit-scrollbar]:hidden">
        {config.presets.map((presetId) => (
          <Button
            key={presetId}
            variant={
              activePresetId === presetId && activeViewId === null
                ? "default"
                : "outline"
            }
            size="sm"
            type="button"
            onClick={() => {
              applyPreset(presetId)
            }}
            className="h-8 shrink-0 gap-1"
            title="Fixed default view"
          >
            <PinIcon aria-hidden="true" className="size-3.5" />
            {TASK_LIST_PRESET_LABELS[presetId]}
          </Button>
        ))}
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
      <Button
        variant="ghost"
        size="sm"
        type="button"
        title="New view"
        className="h-8 shrink-0 gap-1 px-2.5"
        onClick={() => {
          setCreateViewOpen(true)
        }}
      >
        <LayersPlus className="size-4" />
        <span className="hidden @sm/main:inline">New view</span>
      </Button>
      {actions != null ? <Page.Actions>{actions}</Page.Actions> : null}
    </Page.Header>
  )
}
