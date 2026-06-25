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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalFrame,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { TaskSubtaskView } from "@/convex/tasks/queries"
import type { TaskInlineRow } from "@/features/tasks/task-inline-row"
import { cn } from "@/lib/utils"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation } from "convex/react"
import {
  GripVerticalIcon,
  ListOrderedIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react"
import type { CSSProperties, MouseEvent } from "react"
import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"

type SubtaskViewSection = TaskSubtaskView["sections"][number]
type TaskParentRef = NonNullable<SubtaskViewSection["parent"]>

interface EditableTaskRow {
  id: Id<"tasks">
  name: string
  kind: Doc<"tasks">["kind"]
  status: Doc<"tasks">["status"]
  subtaskCount: number
}

interface EditableTaskSection {
  id: string
  title: string
  parent: TaskParentRef
  rows: EditableTaskRow[]
}

const SECTION_DRAG_PREFIX = "section:"

function toEditableTaskRow(row: TaskInlineRow): EditableTaskRow {
  return {
    id: row.task._id,
    name: row.task.name,
    kind: row.task.kind,
    status: row.task.status,
    subtaskCount: row.statusView.progress.total,
  }
}

function isDirectTaskRow(row: TaskInlineRow) {
  return row.path.depth === 0
}

function buildEditableSections(sections: SubtaskViewSection[]) {
  return sections.flatMap((section) => {
    if (section.parent === null) return []
    return [
      {
        id: section.id,
        title: section.title,
        parent: section.parent,
        rows: section.rows.filter(isDirectTaskRow).map(toEditableTaskRow),
      },
    ]
  })
}

function sameOrder(left: EditableTaskRow[], right: EditableTaskRow[]) {
  if (left.length !== right.length) return false
  return left.every((row, index) => row.id === right[index]?.id)
}

function statusLabel(status: Doc<"tasks">["status"]) {
  return status
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ")
}

function sectionDragId(sectionId: string) {
  return `${SECTION_DRAG_PREFIX}${sectionId}`
}

function sectionIdFromDragId(id: UniqueIdentifier) {
  const value = String(id)
  if (!value.startsWith(SECTION_DRAG_PREFIX)) return null
  return value.slice(SECTION_DRAG_PREFIX.length)
}

function findTaskLocation(
  sections: EditableTaskSection[],
  taskId: UniqueIdentifier
) {
  for (const [sectionIndex, section] of sections.entries()) {
    const rowIndex = section.rows.findIndex((row) => row.id === taskId)
    if (rowIndex !== -1) return { rowIndex, sectionIndex }
  }
  return null
}

function getOverSectionIndex(
  sections: EditableTaskSection[],
  overId: UniqueIdentifier
) {
  const sectionId = sectionIdFromDragId(overId)
  if (sectionId !== null) {
    const sectionIndex = sections.findIndex(
      (section) => section.id === sectionId
    )
    return sectionIndex === -1 ? null : sectionIndex
  }

  return findTaskLocation(sections, overId)?.sectionIndex ?? null
}

function moveTaskToOverSection(
  sections: EditableTaskSection[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier
) {
  const activeLocation = findTaskLocation(sections, activeId)
  const overSectionIndex = getOverSectionIndex(sections, overId)
  if (activeLocation === null || overSectionIndex === null) return sections
  if (activeLocation.sectionIndex === overSectionIndex) return sections

  const activeRow =
    sections[activeLocation.sectionIndex].rows[activeLocation.rowIndex]

  const nextSections = sections.map((section) => ({
    ...section,
    rows: [...section.rows],
  }))
  nextSections[activeLocation.sectionIndex].rows.splice(
    activeLocation.rowIndex,
    1
  )

  const overRows = nextSections[overSectionIndex].rows

  const overRowIndex = overRows.findIndex((row) => row.id === overId)
  overRows.splice(
    overRowIndex === -1 ? overRows.length : overRowIndex,
    0,
    activeRow
  )
  return nextSections
}

function reorderTaskInSection(
  sections: EditableTaskSection[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier
) {
  const activeLocation = findTaskLocation(sections, activeId)
  const overLocation = findTaskLocation(sections, overId)
  if (
    activeLocation === null ||
    overLocation === null ||
    activeLocation.sectionIndex !== overLocation.sectionIndex ||
    activeLocation.rowIndex === overLocation.rowIndex
  ) {
    return sections
  }

  return sections.map((section, sectionIndex) =>
    sectionIndex === activeLocation.sectionIndex
      ? {
          ...section,
          rows: arrayMove(
            section.rows,
            activeLocation.rowIndex,
            overLocation.rowIndex
          ),
        }
      : section
  )
}

function findTaskById(
  sections: EditableTaskSection[],
  taskId: Id<"tasks"> | null
) {
  if (taskId === null) return null
  for (const section of sections) {
    const row = section.rows.find((task) => task.id === taskId)
    if (row !== undefined) return row
  }
  return null
}

function TaskRowBody({ row }: { row: EditableTaskRow }) {
  return (
    <>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full min-w-0">
          <span className="truncate">{row.name}</span>
        </ItemTitle>
        <ItemDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{statusLabel(row.status)}</span>
          <span aria-hidden="true">/</span>
          <span>{row.kind === "flow" ? "Flow" : "Standard"}</span>
          {row.subtaskCount > 0 && (
            <>
              <span aria-hidden="true">/</span>
              <span>
                {row.subtaskCount}{" "}
                {row.subtaskCount === 1 ? "subtask" : "subtasks"}
              </span>
            </>
          )}
        </ItemDescription>
      </ItemContent>
    </>
  )
}

function TaskActionsMenu({
  onDelete,
  row,
}: {
  onDelete: (taskId: Id<"tasks">) => Promise<void>
  row: EditableTaskRow
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDeleting(true)
    try {
      await onDelete(row.id)
      setConfirmOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete task"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Open actions for ${row.name}`}
            variant="ghost"
            size="icon-sm"
            type="button"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault()
              setConfirmOpen(true)
            }}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              {row.subtaskCount > 0
                ? `This will delete "${row.name}" and its subtasks.`
                : `This will delete "${row.name}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              variant="destructive"
              onClick={(event) => {
                void handleConfirm(event)
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SortableTaskRow({
  onDelete,
  row,
}: {
  onDelete: (taskId: Id<"tasks">) => Promise<void>
  row: EditableTaskRow
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: row.id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <Item
      ref={setNodeRef}
      role="listitem"
      variant="outline"
      className={cn(
        "flex-nowrap bg-background py-2 pr-2 pl-1.5",
        isDragging && "opacity-40"
      )}
      style={style}
    >
      <ItemMedia variant="icon">
        <Button
          {...attributes}
          {...listeners}
          ref={setActivatorNodeRef}
          aria-label={`Drag ${row.name}`}
          variant="ghost"
          size="icon-sm"
          type="button"
          className="cursor-grab touch-none active:cursor-grabbing"
        >
          <GripVerticalIcon />
        </Button>
      </ItemMedia>
      <TaskRowBody row={row} />
      <ItemActions>
        <TaskActionsMenu row={row} onDelete={onDelete} />
      </ItemActions>
    </Item>
  )
}

function DragPreview({ row }: { row: EditableTaskRow }) {
  return (
    <Item
      role="presentation"
      variant="outline"
      className="flex-nowrap bg-popover py-2 pr-2 pl-1.5 shadow-lg ring-1 ring-foreground/10"
    >
      <ItemMedia variant="icon" className="px-2 text-muted-foreground">
        <GripVerticalIcon />
      </ItemMedia>
      <TaskRowBody row={row} />
    </Item>
  )
}

function EditableSection({
  baselineRows,
  onDelete,
  section,
}: {
  baselineRows: EditableTaskRow[]
  onDelete: (taskId: Id<"tasks">) => Promise<void>
  section: EditableTaskSection
}) {
  const changed = !sameOrder(section.rows, baselineRows)
  const { isOver, setNodeRef } = useDroppable({ id: sectionDragId(section.id) })

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-sm font-medium">{section.title}</h3>
        {changed && <Badge variant="secondary">Unsaved</Badge>}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-lg border bg-muted/20 p-2 transition-colors",
          isOver && "border-primary bg-primary/5"
        )}
      >
        <SortableContext
          items={section.rows.map((row) => row.id)}
          strategy={verticalListSortingStrategy}
        >
          {section.rows.length > 0 ? (
            <ItemGroup className="gap-2">
              {section.rows.map((row) => (
                <SortableTaskRow key={row.id} row={row} onDelete={onDelete} />
              ))}
            </ItemGroup>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">No tasks</p>
          )}
        </SortableContext>
      </div>
    </section>
  )
}

export function EditTasksDialog({
  sections,
}: {
  sections: SubtaskViewSection[]
}) {
  const reorderTaskSections = useMutation(
    api.tasks.mutations.reorderTaskSections
  )
  const deleteTask = useMutation(api.tasks.mutations.deleteTask)
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<Id<"tasks"> | null>(null)
  const [activeStartSectionId, setActiveStartSectionId] = useState<
    string | null
  >(null)
  const [editableSections, setEditableSections] = useState<
    EditableTaskSection[]
  >([])
  const baselineSections = useMemo(
    () => buildEditableSections(sections),
    [sections]
  )
  const baselineRowsBySection = useMemo(
    () =>
      new Map(
        baselineSections.map((section) => [section.id, section.rows] as const)
      ),
    [baselineSections]
  )
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const activeTask = findTaskById(editableSections, activeTaskId)
  const hasChanges = editableSections.some((section) => {
    const baselineRows = baselineRowsBySection.get(section.id) ?? []
    return !sameOrder(section.rows, baselineRows)
  })

  function resetDragState() {
    setActiveTaskId(null)
    setActiveStartSectionId(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isSaving) return
    if (nextOpen) {
      setEditableSections(baselineSections)
    } else {
      resetDragState()
    }
    setOpen(nextOpen)
  }

  async function handleDelete(taskId: Id<"tasks">) {
    await deleteTask({ id: taskId })
    setEditableSections((currentSections) =>
      currentSections.map((section) => ({
        ...section,
        rows: section.rows.filter((row) => row.id !== taskId),
      }))
    )
    if (activeTaskId === taskId) resetDragState()
    toast.success("Task deleted")
  }

  function handleDragStart(event: DragStartEvent) {
    const location = findTaskLocation(editableSections, event.active.id)
    if (location === null) return
    const section = editableSections[location.sectionIndex]
    setActiveTaskId(section.rows[location.rowIndex].id)
    setActiveStartSectionId(section.id)
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id
    if (overId === undefined) return
    setEditableSections((currentSections) =>
      moveTaskToOverSection(currentSections, event.active.id, overId)
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id
    if (overId !== undefined) {
      setEditableSections((currentSections) => {
        const activeLocation = findTaskLocation(
          currentSections,
          event.active.id
        )
        if (activeLocation === null) return currentSections
        if (
          currentSections[activeLocation.sectionIndex].id !==
          activeStartSectionId
        ) {
          return currentSections
        }
        return reorderTaskInSection(currentSections, event.active.id, overId)
      })
    }
    resetDragState()
  }

  async function handleSave() {
    if (!hasChanges) {
      setOpen(false)
      return
    }

    setIsSaving(true)
    try {
      await reorderTaskSections({
        sections: editableSections.map((section) => ({
          parent: section.parent,
          taskIds: section.rows.map((row) => row.id),
        })),
      })
      toast.success("Task changes saved")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save task changes"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalTrigger asChild>
        <Button variant="outline" size="lg" type="button">
          <ListOrderedIcon />
          Edit Tasks
        </Button>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent className="sm:max-w-3xl">
        <ResponsiveModalFrame>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Edit tasks</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Drag direct tasks within a section or into another phase. Deleting
              a task also deletes its subtasks.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalBody className="grid gap-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {
                resetDragState()
              }}
            >
              <ScrollArea className="pr-3">
                <div className="grid gap-4">
                  {editableSections.map((section) => (
                    <EditableSection
                      key={section.id}
                      baselineRows={baselineRowsBySection.get(section.id) ?? []}
                      section={section}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </ScrollArea>
              {createPortal(
                <DragOverlay>
                  {activeTask !== null ? (
                    <DragPreview row={activeTask} />
                  ) : null}
                </DragOverlay>,
                document.body
              )}
            </DndContext>
          </ResponsiveModalBody>
          <ResponsiveModalFooter>
            <Button
              disabled={isSaving}
              variant="outline"
              type="button"
              onClick={() => {
                setOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!hasChanges || isSaving}
              onClick={() => {
                void handleSave()
              }}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalFrame>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
