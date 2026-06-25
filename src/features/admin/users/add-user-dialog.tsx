import { useMutation } from "convex/react"
import { useState, type SubmitEvent } from "react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { findLoginProvider } from "@/config/lib/organisation"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalForm,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { Spinner } from "@/components/ui/spinner"

const showEmailField = findLoginProvider("google") !== undefined
const showWcaIdField = findLoginProvider("wca-staff") !== undefined

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
    const trimmedEmail = showEmailField ? email.trim() : ""
    const trimmedWcaId = showWcaIdField ? wcaUserId.trim() : ""
    const parsedWcaId =
      trimmedWcaId.length > 0 ? parseInt(trimmedWcaId, 10) : undefined

    const hasEmail = trimmedEmail.length > 0
    const hasWcaId = parsedWcaId !== undefined

    if (!hasEmail && !hasWcaId) {
      if (showEmailField && showWcaIdField) {
        setError("An email or WCA User ID is required.")
      } else if (showEmailField) {
        setError("An email is required.")
      } else {
        setError("A WCA User ID is required.")
      }
      return
    }
    if (hasWcaId && (isNaN(parsedWcaId) || parsedWcaId <= 0)) {
      setError("WCA User ID must be a positive number.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const userId = await createUser({
        name: name.trim().length > 0 ? name.trim() : undefined,
        email: hasEmail ? trimmedEmail : undefined,
        wcaUserId: hasWcaId ? parsedWcaId : undefined,
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
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalForm onSubmit={(e) => void handleSubmit(e)}>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Add User</ResponsiveModalTitle>
            {showEmailField && showWcaIdField ? (
              <ResponsiveModalDescription>
                At least an email or WCA User ID is required.
              </ResponsiveModalDescription>
            ) : null}
          </ResponsiveModalHeader>
          <ResponsiveModalBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="add-user-name">Name</FieldLabel>
                <Input
                  id="add-user-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                  }}
                  placeholder="Full name"
                />
              </Field>
              {showEmailField ? (
                <Field>
                  <FieldLabel htmlFor="add-user-email">Email</FieldLabel>
                  <Input
                    id="add-user-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                    }}
                    placeholder="user@example.com"
                  />
                </Field>
              ) : null}
              {showWcaIdField ? (
                <Field>
                  <FieldLabel htmlFor="add-user-wca">WCA User ID</FieldLabel>
                  <Input
                    id="add-user-wca"
                    type="number"
                    min={1}
                    value={wcaUserId}
                    onChange={(e) => {
                      setWcaUserId(e.target.value)
                    }}
                    placeholder="e.g. 123456"
                  />
                </Field>
              ) : null}
              <FieldError>{error}</FieldError>
            </FieldGroup>
          </ResponsiveModalBody>
          <ResponsiveModalFooter>
            <ResponsiveModalClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </ResponsiveModalClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              Add User
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalForm>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
