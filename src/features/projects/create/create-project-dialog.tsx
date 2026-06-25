import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
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
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal"
import { MarkdownEditorField } from "@/features/shared/markdown-editor-field"
import type { Doc } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { useMutation } from "convex/react"
import { LoaderCircleIcon, PlusIcon } from "lucide-react"
import { useState, type SyntheticEvent } from "react"
import { PhaseColorSelect } from "@/components/data-selectors/phase-color-select"
import type { PhaseColor } from "@/convex/phases/colors"

type ProjectScope = Doc<"projects">["scope"]

export function CreateProjectDialog({ scope }: { scope: ProjectScope }) {
  const createProject = useMutation(api.projects.mutations.create)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [firstPhaseName, setFirstPhaseName] = useState("")
  const [firstPhaseColor, setFirstPhaseColor] = useState<PhaseColor>("gray")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setName("")
    setDescription("")
    setFirstPhaseName("")
    setFirstPhaseColor("gray")
    setSubmitError(null)
    setIsSubmitting(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) resetForm()
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length === 0 || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const trimmedPhaseName = firstPhaseName.trim()
      await createProject({
        name: trimmedName,
        description: description.trim().length > 0 ? description.trim() : null,
        scope,
        firstPhaseName:
          trimmedPhaseName.length > 0 ? trimmedPhaseName : undefined,
        firstPhaseColor:
          trimmedPhaseName.length > 0 ? firstPhaseColor : undefined,
      })
      setOpen(false)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not create project."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const trimmedFirstPhaseName = firstPhaseName.trim()
  const hasFirstPhase = trimmedFirstPhaseName.length > 0
  const canSubmit = name.trim().length > 0 && !isSubmitting

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalTrigger asChild>
        <Button type="button">
          <PlusIcon />
          New project
        </Button>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent className="sm:max-w-xl">
        <ResponsiveModalForm
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
        >
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Create project</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              {scope.type === "teams"
                ? "Create a project scoped to this team."
                : "Create a project visible to all active volunteers."}
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <ResponsiveModalBody className="grid gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="project-name">Name</FieldLabel>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.currentTarget.value)
                  }}
                  disabled={isSubmitting}
                  required
                />
              </Field>

              <MarkdownEditorField
                id="project-description"
                label="Description"
                value={description}
                onChange={setDescription}
                placeholder="Describe what this project is for..."
                disabled={isSubmitting}
              />

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
                <Field>
                  <FieldLabel htmlFor="project-first-phase">
                    First phase
                  </FieldLabel>
                  <Input
                    id="project-first-phase"
                    value={firstPhaseName}
                    onChange={(event) => {
                      setFirstPhaseName(event.currentTarget.value)
                    }}
                    placeholder="e.g. Planning"
                    disabled={isSubmitting}
                  />
                  <FieldDescription>Optional</FieldDescription>
                </Field>

                <Field data-disabled={!hasFirstPhase}>
                  <FieldLabel>Phase color</FieldLabel>
                  <PhaseColorSelect
                    value={firstPhaseColor}
                    disabled={!hasFirstPhase || isSubmitting}
                    onChange={setFirstPhaseColor}
                  />
                  <FieldDescription>
                    {hasFirstPhase
                      ? "Used on project cards."
                      : "Add a phase name first."}
                  </FieldDescription>
                </Field>
              </div>

              {submitError !== null ? (
                <FieldError>{submitError}</FieldError>
              ) : null}
            </FieldGroup>
          </ResponsiveModalBody>

          <ResponsiveModalFooter>
            <ResponsiveModalClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </ResponsiveModalClose>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : null}
              {isSubmitting ? "Creating..." : "Create project"}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalForm>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
