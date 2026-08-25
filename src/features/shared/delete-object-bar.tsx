import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { TrashIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export function DeleteObjectBar({
  objectLabel,
  description,
  confirmationDescription,
  onDelete,
}: {
  objectLabel: "task" | "competition"
  description: string
  confirmationDescription: string
  onDelete: () => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await onDelete()
      setIsOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to delete ${objectLabel}.`
      )
      setIsDeleting(false)
    }
  }

  return (
    <div className="col-span-full flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 @sm/main:flex-row @sm/main:items-center @sm/main:justify-between">
      <div>
        <p className="font-medium">Delete this {objectLabel}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <AlertDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!isDeleting) setIsOpen(open)
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            <TrashIcon />
            Delete {objectLabel}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {objectLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationDescription} This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {isDeleting ? "Deleting…" : `Delete ${objectLabel}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
