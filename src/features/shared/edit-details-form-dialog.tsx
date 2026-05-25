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
import { MarkdownEditorField } from "@/features/shared/markdown-editor-field"
import { PencilIcon } from "lucide-react"
import { useState } from "react"

type DetailsFormValue = {
  description: string | null
  name: string
}

type EditDetailsFormDialogProps = {
  descriptionId: string
  descriptionPlaceholder: string
  initialValue: DetailsFormValue
  nameId: string
  title: string
  triggerLabel: string
  onSubmit: (value: DetailsFormValue) => void | Promise<void | null>
}

export function EditDetailsFormDialog({
  descriptionId,
  descriptionPlaceholder,
  initialValue,
  nameId,
  title,
  triggerLabel,
  onSubmit,
}: EditDetailsFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialValue.name)
  const [description, setDescription] = useState(
    initialValue.description ?? ""
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setName(initialValue.name)
    setDescription(initialValue.description ?? "")
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) resetForm()
  }

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim() || null,
      })
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label={triggerLabel}>
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="grid max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          className="grid min-h-0 gap-4"
        >
          <DialogHeader className="pr-8">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Write in Markdown and preview before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <MarkdownEditorField
            id={descriptionId}
            label="Description"
            placeholder={descriptionPlaceholder}
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
