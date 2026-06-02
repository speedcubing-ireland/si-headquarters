import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { PencilIcon } from "lucide-react"
import { useState } from "react"

export function WeekendNoteDialog({
  weekendLabel,
  note,
  open,
  onOpenChange,
  onSave,
}: {
  weekendLabel: string
  note: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (note: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(note)
  const [isSaving, setIsSaving] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraft(note)
    onOpenChange(nextOpen)
  }

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await onSave(draft.trim())
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Weekend note — {weekendLabel}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="weekend-note">Note</Label>
            <Input
              id="weekend-note"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
              }}
              placeholder="Single-line note"
              className="mt-2"
              maxLength={200}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WeekendNoteTrigger({
  note,
  weekendLabel,
  onSave,
  className,
}: {
  note: string
  weekendLabel: string
  onSave: (note: string) => Promise<void>
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const trimmed = note.trim()
  const hasNote = trimmed.length > 0

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setOpen(true)
        }}
        aria-label={hasNote ? `Edit note: ${trimmed}` : "Add note"}
        className="group/note h-7 w-full min-w-0 justify-start gap-2 px-2 text-left text-sm font-normal group-hover/weekend:border group-hover/weekend:border-dashed group-hover/weekend:border-border/50"
      >
        {hasNote ? (
          <>
            <span className="min-w-0 truncate font-medium text-foreground">
              {trimmed}
            </span>
            <PencilIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </>
        ) : (
          <>
            <span className="min-w-0 truncate text-muted-foreground opacity-0 group-hover:opacity-100 group-hover/weekend:opacity-100">
              Add note…
            </span>
            <PencilIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-hover/weekend:opacity-100" />
          </>
        )}
      </Button>
      <WeekendNoteDialog
        weekendLabel={weekendLabel}
        note={note}
        open={open}
        onOpenChange={setOpen}
        onSave={onSave}
      />
    </div>
  )
}
