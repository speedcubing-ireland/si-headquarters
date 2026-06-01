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
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useMutation } from "convex/react"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { MarkdownEditorField } from "@/features/shared/markdown-editor-field"

export function AddUpdateDialog({ comp }: { comp: Doc<"competitions"> }) {
  const setUpdate = useMutation(
    api.competitions.updates.mutations.setForCompetition
  )
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)

    if (nextOpen) {
      setBody("")
    }
  }

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedBody = body.trim()
    if (!trimmedBody) return

    setIsSubmitting(true)
    try {
      await setUpdate({
        competitionId: comp._id,
        body: trimmedBody,
      })
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Add competition update"
        >
          <PlusIcon />
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
            <DialogTitle>Add competition update</DialogTitle>
            <DialogDescription>
              Write in Markdown and preview before saving.
            </DialogDescription>
          </DialogHeader>

          <MarkdownEditorField
            id="competition-update"
            label="Update"
            placeholder="Add the competition update..."
            value={body}
            onChange={setBody}
            disabled={isSubmitting}
          />

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !body.trim()}>
              {isSubmitting ? "Saving..." : "Save update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
