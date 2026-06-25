import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PhaseColorSelect } from "@/components/data-selectors/phase-color-select"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import { useMutation, useQuery } from "convex/react"
import {
  GripVerticalIcon,
  ListOrderedIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import type { CSSProperties } from "react"
import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"

type PhaseOwner = Doc<"phases">["owner"]
type PhaseColor = Doc<"phases">["color"]
type ManagePhase = Doc<"phases"> & {
  hasTasks: boolean
  isCurrent: boolean
}

interface EditablePhase {
  clientId: string
  id: Id<"phases"> | null
  name: string
  color: PhaseColor
  hasTasks: boolean
  isCurrent: boolean
}

function toEditablePhase(phase: ManagePhase): EditablePhase {
  return {
    clientId: phase._id,
    id: phase._id,
    name: phase.name,
    color: phase.color,
    hasTasks: phase.hasTasks,
    isCurrent: phase.isCurrent,
  }
}

function newEditablePhase(): EditablePhase {
  return {
    clientId: `new:${crypto.randomUUID()}`,
    id: null,
    name: "",
    color: "gray",
    hasTasks: false,
    isCurrent: false,
  }
}

function samePhases(left: EditablePhase[], right: EditablePhase[]) {
  if (left.length !== right.length) return false
  return left.every((phase, index) => {
    const baseline = right[index]
    return (
      phase.id === baseline.id &&
      phase.name.trim() === baseline.name.trim() &&
      phase.color === baseline.color
    )
  })
}

function findPhaseByClientId(
  phases: EditablePhase[],
  clientId: UniqueIdentifier | null
) {
  if (clientId === null) return null
  return phases.find((phase) => phase.clientId === clientId) ?? null
}

function phaseDeleteDisabledReason(phase: EditablePhase) {
  if (phase.hasTasks) return "Delete the tasks in this phase first."
  return null
}

function PhaseRowBody({ phase }: { phase: EditablePhase }) {
  const deleteDisabledReason = phaseDeleteDisabledReason(phase)

  return (
    <ItemContent className="min-w-0">
      <ItemTitle className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="truncate">
          {phase.name.trim() || "Untitled phase"}
        </span>
        {phase.isCurrent && <Badge>Current</Badge>}
      </ItemTitle>
      <ItemDescription>
        {phase.id === null
          ? "New phase"
          : (deleteDisabledReason ?? "Empty phase")}
      </ItemDescription>
    </ItemContent>
  )
}

function SortablePhaseRow({
  disabled,
  onChangeColor,
  onChangeName,
  onDelete,
  phase,
}: {
  disabled: boolean
  onChangeColor: (clientId: string, color: PhaseColor) => void
  onChangeName: (clientId: string, name: string) => void
  onDelete: (clientId: string) => void
  phase: EditablePhase
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: phase.clientId, disabled })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const deleteDisabledReason = phaseDeleteDisabledReason(phase)

  return (
    <Item
      ref={setNodeRef}
      role="listitem"
      variant="outline"
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 bg-background py-2 pr-2 pl-1.5",
        isDragging && "opacity-40"
      )}
      style={style}
    >
      <ItemMedia variant="icon">
        <Button
          {...attributes}
          {...listeners}
          ref={setActivatorNodeRef}
          aria-label={`Drag ${phase.name.trim() || "phase"}`}
          variant="ghost"
          size="icon-sm"
          type="button"
          className="cursor-grab touch-none active:cursor-grabbing"
          disabled={disabled}
        >
          <GripVerticalIcon />
        </Button>
      </ItemMedia>
      <div className="grid min-w-0 gap-1">
        <Label className="sr-only" htmlFor={`${phase.clientId}:name`}>
          Phase name
        </Label>
        <Input
          id={`${phase.clientId}:name`}
          value={phase.name}
          disabled={disabled}
          placeholder="Phase name"
          onChange={(event) => {
            onChangeName(phase.clientId, event.currentTarget.value)
          }}
        />
        <PhaseRowBody phase={phase} />
      </div>
      <PhaseColorSelect
        value={phase.color}
        className="h-8 w-32"
        disabled={disabled}
        onChange={(color) => {
          onChangeColor(phase.clientId, color)
        }}
      />
      <ItemActions>
        <Button
          aria-label={`Delete ${phase.name.trim() || "phase"}`}
          variant="ghost"
          size="icon-sm"
          type="button"
          disabled={disabled || deleteDisabledReason !== null}
          title={deleteDisabledReason ?? undefined}
          onClick={() => {
            onDelete(phase.clientId)
          }}
        >
          <Trash2Icon />
        </Button>
      </ItemActions>
    </Item>
  )
}

function PhaseDragPreview({ phase }: { phase: EditablePhase }) {
  return (
    <Item
      role="presentation"
      variant="outline"
      className="grid grid-cols-[auto_minmax(0,1fr)] bg-popover py-2 pr-2 pl-1.5 shadow-lg ring-1 ring-foreground/10"
    >
      <ItemMedia variant="icon" className="px-2 text-muted-foreground">
        <GripVerticalIcon />
      </ItemMedia>
      <PhaseRowBody phase={phase} />
    </Item>
  )
}

function EditPhasesDialog({
  owner,
  phases,
}: {
  owner: PhaseOwner
  phases: ManagePhase[]
}) {
  const savePhases = useMutation(api.phases.mutations.saveForOwner)
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const [editablePhases, setEditablePhases] = useState<EditablePhase[]>([])
  const baselinePhases = useMemo(() => phases.map(toEditablePhase), [phases])
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const activePhase = findPhaseByClientId(editablePhases, activeClientId)
  const hasEmptyName = editablePhases.some(
    (phase) => phase.name.trim().length === 0
  )
  const hasChanges = !samePhases(editablePhases, baselinePhases)

  function handleOpenChange(nextOpen: boolean) {
    if (isSaving) return
    if (nextOpen) {
      setEditablePhases(baselinePhases)
    } else {
      setActiveClientId(null)
    }
    setOpen(nextOpen)
  }

  function updatePhase(
    clientId: string,
    update: (phase: EditablePhase) => EditablePhase
  ) {
    setEditablePhases((current) =>
      current.map((phase) =>
        phase.clientId === clientId ? update(phase) : phase
      )
    )
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveClientId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over !== null && active.id !== over.id) {
      setEditablePhases((current) => {
        const oldIndex = current.findIndex(
          (phase) => phase.clientId === active.id
        )
        const newIndex = current.findIndex(
          (phase) => phase.clientId === over.id
        )
        if (oldIndex === -1 || newIndex === -1) return current
        return arrayMove(current, oldIndex, newIndex)
      })
    }
    setActiveClientId(null)
  }

  async function handleSave() {
    if (!hasChanges) {
      setOpen(false)
      return
    }

    setIsSaving(true)
    try {
      await savePhases({
        owner,
        phases: editablePhases.map((phase) => ({
          id: phase.id,
          name: phase.name,
          color: phase.color,
        })),
      })
      toast.success("Phase changes saved")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save phase changes"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          <ListOrderedIcon />
          Edit phases
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Edit phases</DialogTitle>
          <DialogDescription>
            Create phases, drag them into order, and remove empty phases.
            Changes are applied when you save.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            type="button"
            disabled={isSaving}
            onClick={() => {
              setEditablePhases((current) => [...current, newEditablePhase()])
            }}
          >
            <PlusIcon />
            Add phase
          </Button>
          {hasChanges && <Badge variant="secondary">Unsaved</Badge>}
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveClientId(null)
          }}
        >
          <ScrollArea className="max-h-[min(62svh,34rem)] pr-3">
            <SortableContext
              items={editablePhases.map((phase) => phase.clientId)}
              strategy={verticalListSortingStrategy}
            >
              {editablePhases.length > 0 ? (
                <ItemGroup className="gap-2">
                  {editablePhases.map((phase) => (
                    <SortablePhaseRow
                      key={phase.clientId}
                      disabled={isSaving}
                      phase={phase}
                      onChangeName={(clientId, name) => {
                        updatePhase(clientId, (current) => ({
                          ...current,
                          name,
                        }))
                      }}
                      onChangeColor={(clientId, color) => {
                        updatePhase(clientId, (current) => ({
                          ...current,
                          color,
                        }))
                      }}
                      onDelete={(clientId) => {
                        setEditablePhases((current) =>
                          current.filter((phase) => phase.clientId !== clientId)
                        )
                      }}
                    />
                  ))}
                </ItemGroup>
              ) : (
                <p className="rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                  No phases
                </p>
              )}
            </SortableContext>
          </ScrollArea>
          {createPortal(
            <DragOverlay>
              {activePhase !== null ? (
                <PhaseDragPreview phase={activePhase} />
              ) : null}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
        <DialogFooter>
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
            disabled={!hasChanges || hasEmptyName || isSaving}
            onClick={() => {
              void handleSave()
            }}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EditPhasesButton({ owner }: { owner: PhaseOwner }) {
  const phases = useQuery(api.phases.queries.listManageForOwner, { owner })

  if (phases === undefined) {
    return null
  }

  return <EditPhasesDialog owner={owner} phases={phases} />
}
