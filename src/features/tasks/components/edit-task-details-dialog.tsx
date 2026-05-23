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
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { MarkdownEditorField } from "@/features/competitions/components/markdown-editor-field"
import { useMutation } from "convex/react"
import { PencilIcon } from "lucide-react"
import { useState } from "react"

export function EditTaskDetailsDialog({ task }: { task: Doc<"tasks"> }) {
  const updateDetails = useMutation(api.tasks.mutations.setTaskDetails)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(task.name)
  const [description, setDescription] = useState(task.description ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setName(task.name)
    setDescription(task.description ?? "")
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)

    if (nextOpen) {
      resetForm()
    }
  }

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) return

    setIsSubmitting(true)
    try {
      await updateDetails({
        id: task._id,
        name: trimmedName,
        description: description.trim().length > 0 ? description.trim() : null,
      })
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Edit task details">
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="grid max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="grid min-h-0 gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle>Edit task details</DialogTitle>
            <DialogDescription>
              Write in Markdown and preview before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="task-name">Name</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <MarkdownEditorField
            id="task-description"
            label="Description"
            placeholder="Add the task description..."
            value={description}
            onChange={setDescription}
            disabled={isSubmitting}
          />

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
