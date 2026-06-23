import { useMutation } from "convex/react"
import { useState, type SubmitEvent } from "react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

interface AddUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (userId: Id<"users">) => void
}

export function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: AddUserDialogProps) {
  const createUser = useMutation(api.users.mutations.createForAdmin)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [wcaUserId, setWcaUserId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName("")
    setEmail("")
    setWcaUserId("")
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    const trimmedWcaId = wcaUserId.trim()
    const parsedWcaId =
      trimmedWcaId.length > 0 ? parseInt(trimmedWcaId, 10) : undefined

    if (trimmedEmail.length === 0 && trimmedWcaId.length === 0) {
      setError("An email or WCA User ID is required.")
      return
    }
    if (parsedWcaId !== undefined && (isNaN(parsedWcaId) || parsedWcaId <= 0)) {
      setError("WCA User ID must be a positive number.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const userId = await createUser({
        name: name.trim().length > 0 ? name.trim() : undefined,
        email: trimmedEmail.length > 0 ? trimmedEmail : undefined,
        wcaUserId: parsedWcaId,
      })
      toast.success("User created")
      handleOpenChange(false)
      onCreated(userId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create user."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>
            At least an email or WCA User ID is required.
          </DialogDescription>
        </DialogHeader>
        <form id="add-user-form" onSubmit={(e) => void handleSubmit(e)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="add-user-name">Name</FieldLabel>
              <Input
                id="add-user-name"
                value={name}
                onChange={(e) =>{  setName(e.target.value); }}
                placeholder="Full name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="add-user-email">Email</FieldLabel>
              <Input
                id="add-user-email"
                type="email"
                value={email}
                onChange={(e) =>{  setEmail(e.target.value); }}
                placeholder="user@example.com"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="add-user-wca">WCA User ID</FieldLabel>
              <Input
                id="add-user-wca"
                type="number"
                min={1}
                value={wcaUserId}
                onChange={(e) =>{  setWcaUserId(e.target.value); }}
                placeholder="e.g. 123456"
              />
            </Field>
            <FieldError>{error}</FieldError>
          </FieldGroup>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="add-user-form" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            Add User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
