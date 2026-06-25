import { Button } from "@/components/ui/button"
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalForm,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownEditorField } from "@/features/shared/markdown-editor-field"
import { PencilIcon } from "lucide-react"
import { useState } from "react"

interface DetailsFormValue {
  description: string | null
  name: string
}

interface EditDetailsFormDialogProps {
  descriptionId: string
  descriptionPlaceholder: string
  initialValue: DetailsFormValue
  nameId: string
  title: string
  triggerLabel: string
  onSubmit: (value: DetailsFormValue) => Promise<null> | undefined
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
  const [description, setDescription] = useState(initialValue.description ?? "")
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
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalTrigger asChild>
        <Button variant="outline" size="icon" aria-label={triggerLabel}>
          <PencilIcon />
        </Button>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent className="sm:max-w-2xl">
        <ResponsiveModalForm
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
        >
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Write in Markdown and preview before saving.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <ResponsiveModalBody className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={nameId}>Name</Label>
              <Input
                id={nameId}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                }}
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
          </ResponsiveModalBody>

          <ResponsiveModalFooter>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalForm>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
