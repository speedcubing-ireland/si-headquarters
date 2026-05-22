import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useMutation } from "convex/react"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { Streamdown } from "streamdown"

export function EditDetailsDialog({
  comp,
}: {
  comp: Doc<"competitions">
}) {
  const updateDetails = useMutation(api.competitions.mutations.setCompDetails)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(comp.name)
  const [description, setDescription] = useState(comp.description ?? "")
  const [preview, setPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setName(comp.name)
    setDescription(comp.description ?? "")
    setPreview(false)
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
        id: comp._id,
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
        <Button
          variant="outline"
          size="icon"
          aria-label="Edit competition details"
        >
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="grid max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="grid min-h-0 gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle>Edit competition details</DialogTitle>
            <DialogDescription>
              Write in Markdown and preview before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="competition-name">Name</Label>
            <Input
              id="competition-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="grid min-h-0 gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="competition-description">Description</Label>
              <Label
                htmlFor="competition-description-preview"
                className="gap-2 text-sm text-muted-foreground"
              >
                Preview
                <Switch
                  id="competition-description-preview"
                  checked={preview}
                  onCheckedChange={setPreview}
                  disabled={isSubmitting}
                />
              </Label>
            </div>

            <div className="min-h-0 rounded-lg border bg-background shadow-xs">
              <Textarea
                id="competition-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add the competition description..."
                disabled={isSubmitting}
                className={cn(
                  "h-[min(42svh,20rem)] min-h-48 resize-none border-0 bg-transparent p-3 font-mono text-sm shadow-none focus-visible:ring-0",
                  preview && "hidden"
                )}
              />
              <ScrollArea
                className={cn(
                  "h-[min(42svh,20rem)] min-h-48 p-3",
                  !preview && "hidden"
                )}
              >
                {description.trim() ? (
                  <Streamdown>{description}</Streamdown>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing to preview yet.
                  </p>
                )}
              </ScrollArea>
            </div>
          </div>

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
