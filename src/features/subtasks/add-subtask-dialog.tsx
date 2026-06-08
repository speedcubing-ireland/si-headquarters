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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { TaskSubtaskView } from "@/convex/tasks/queries"
import { useMutation } from "convex/react"
import { useNavigate } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { toast } from "sonner"

type SubtaskViewOwner = TaskSubtaskView["owner"]
type SubtaskViewSection = TaskSubtaskView["sections"][number]
type PhaseSection = SubtaskViewSection & { phaseId: Id<"phases"> }

function isPhaseSection(
  section: SubtaskViewSection
): section is PhaseSection {
  return section.phaseId !== null
}

function getDefaultPhaseId(sections: SubtaskViewSection[]) {
  const current = sections.find(
    (section) => section.isCurrent && section.phaseId !== null
  )
  if (current?.phaseId) return current.phaseId

  return sections.find((section) => section.phaseId !== null)?.phaseId ?? null
}

export function AddSubtaskDialog({
  owner,
  sections = [],
  children,
  triggerLabel = "Add Task",
}: {
  owner: SubtaskViewOwner
  sections?: SubtaskViewSection[]
  children?: ReactNode
  triggerLabel?: string
}) {
  const navigate = useNavigate()
  const createChildTask = useMutation(api.tasks.mutations.createChildTask)
  const phaseSections = useMemo(
    () => sections.filter(isPhaseSection),
    [sections]
  )
  const defaultPhaseId = useMemo(
    () => getDefaultPhaseId(sections),
    [sections]
  )

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [phaseId, setPhaseId] = useState<Id<"phases"> | null>(defaultPhaseId)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setName("")
    setPhaseId(defaultPhaseId)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) resetForm()
  }

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) return

    const parent =
      owner.type === "tasks"
        ? { type: "tasks" as const, id: owner.id }
        : phaseId === null
          ? null
          : { type: "phases" as const, id: phaseId }

    if (parent === null) {
      toast.error("Choose a phase for the new task.")
      return
    }

    setIsSubmitting(true)
    try {
      const taskId = await createChildTask({
        parent,
        name: trimmedName,
      })
      setOpen(false)
      toast.success("Task created", {
        action: {
          label: "Open",
          onClick: () => {
            void navigate({ to: "/tasks/$id", params: { id: taskId } })
          },
        },
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create task."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="default" size="lg" type="button">
            <PlusIcon />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
            <DialogDescription>
              {owner.type === "tasks"
                ? "Create a subtask under this task."
                : "Create a task in the selected competition phase."}
            </DialogDescription>
          </DialogHeader>

          {owner.type === "competitions" ? (
            <div className="grid gap-2">
              <Label htmlFor="add-subtask-phase">Phase</Label>
              <Select
                value={phaseId ?? undefined}
                onValueChange={(value) => {
                  const selectedPhase = phaseSections.find(
                    (section) => section.phaseId === value
                  )
                  setPhaseId(selectedPhase?.phaseId ?? null)
                }}
                disabled={isSubmitting || phaseSections.length === 0}
              >
                <SelectTrigger id="add-subtask-phase" className="w-full">
                  <SelectValue placeholder="Select a phase" />
                </SelectTrigger>
                <SelectContent>
                  {phaseSections.map((section) => (
                    <SelectItem
                      key={section.id}
                      value={section.phaseId}
                    >
                      <span className="flex items-center gap-2">
                        {section.title}
                        {section.isCurrent ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Current
                          </Badge>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="add-subtask-name">Name</Label>
            <Input
              id="add-subtask-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
              }}
              placeholder="What needs to be done?"
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                setOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !name.trim() ||
                (owner.type === "competitions" && phaseId === null)
              }
            >
              {isSubmitting ? "Creating..." : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
