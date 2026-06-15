import * as TaskAssigneeSelector from "@/components/data-selectors/task-assignee-selector"
import * as TaskDateSelector from "@/components/data-selectors/task-date-selector"
import type { TaskLabelOption } from "@/components/data-selectors/task-label-display"
import * as TaskLabelSelector from "@/components/data-selectors/task-label-selector"
import * as TaskParentSelector from "@/components/data-selectors/task-parent-selector"
import * as TaskOwnerSelector from "@/components/data-selectors/task-owner-selector"
import {
  resolveSelectedTaskOwner,
  toTaskViewAssignees,
} from "@/components/data-selectors/task-selector-model"
import * as TaskStatusSelector from "@/components/data-selectors/task-status-selector"
import { Button } from "@/components/ui/button"
import { ComboboxPortalContainerProvider } from "@/components/ui/combobox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PopoverPortalContainerProvider } from "@/components/ui/popover"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { SubtaskViewOwner, TaskSubtaskView } from "@/convex/tasks/queries"
import { MarkdownEditorField } from "@/features/shared/markdown-editor-field"
import { useMutation, useQuery } from "convex/react"
import { PlusIcon } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

type TaskStatus = Doc<"tasks">["status"]
type TaskAssigneeIds = Doc<"tasks">["assigneeIds"]
type TaskOwnerRef = Doc<"tasks">["owner"]
type TaskParentRef = NonNullable<TaskSubtaskView["defaultParent"]>

const INITIAL_STATUS_OPTIONS = ["backlog", "to-do", "in-progress"] as const

export function AddTaskDialog({
  children,
  initialParent = null,
  parentScope,
}: {
  children?: ReactNode
  initialParent?: TaskParentRef | null
  parentScope: SubtaskViewOwner
}) {
  const createTask = useMutation(api.tasks.mutations.createTask)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [parent, setParent] = useState<TaskParentRef | null>(initialParent)
  const [initialStatus, setInitialStatus] = useState<TaskStatus>("backlog")
  const [assigneeIds, setAssigneeIds] = useState<TaskAssigneeIds>(null)
  const [owner, setOwner] = useState<TaskOwnerRef>(null)
  const [labelIds, setLabelIds] = useState<Id<"taskLabels">[]>([])
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const assignmentOptions = useQuery(
    api.tasks.queries.listAssignmentOptions,
    open ? { scope: parentScope } : "skip"
  )
  const labels = useQuery(api.tasks.labels.queries.list, open ? {} : "skip")
  const users = assignmentOptions?.users
  const teams = assignmentOptions?.teams

  const selectedLabels = useMemo((): TaskLabelOption[] => {
    const labelById = new Map(labels?.map((label) => [label._id, label]))
    const selected: TaskLabelOption[] = []
    for (const labelId of labelIds) {
      const label = labelById.get(labelId)
      if (label !== undefined) selected.push(label)
    }
    return selected
  }, [labelIds, labels])
  const assigneeState = useMemo(
    () => toTaskViewAssignees(assigneeIds, users),
    [assigneeIds, users]
  )
  const selectedOwner = useMemo(
    () => resolveSelectedTaskOwner(owner, users, teams),
    [owner, teams, users]
  )

  const resetForm = () => {
    setName("")
    setDescription("")
    setParent(initialParent)
    setInitialStatus("backlog")
    setAssigneeIds(null)
    setOwner(null)
    setLabelIds([])
    setDueDate(null)
    setSubmitError(null)
    setIsSubmitting(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) resetForm()
  }

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length === 0 || parent === null || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await createTask({
        name: trimmedName,
        description: description.trim() || null,
        parent,
        scope: parentScope,
        initialStatus,
        assigneeIds,
        owner,
        dueDate,
        labelIds,
      })
      setOpen(false)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not create task."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = name.trim().length > 0 && parent !== null && !isSubmitting

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children ?? (
          <Button type="button">
            <PlusIcon />
            New task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="top-[max(1rem,calc(50svh-24rem))] right-4 left-4 max-h-[calc(100svh-2rem)] w-auto max-w-none translate-x-0 translate-y-0 overflow-visible p-0 sm:right-[max(1rem,calc(50%-21rem))] sm:left-[max(1rem,calc(50%-21rem))] sm:max-w-none">
        <div
          ref={setPortalContainer}
          className="pointer-events-none fixed inset-0 z-60"
        />
        <ComboboxPortalContainerProvider
          container={portalContainer ?? undefined}
        >
          <PopoverPortalContainerProvider
            container={portalContainer ?? undefined}
          >
            <form
              className="grid max-h-[calc(100svh-2rem)] min-h-0 grid-rows-[minmax(0,1fr)_auto]"
              onSubmit={(event) => {
                void handleSubmit(event)
              }}
            >
              <div className="grid min-h-0 gap-4 overflow-y-auto p-4">
                <DialogHeader className="pr-8">
                  <DialogTitle>New task</DialogTitle>
                  <DialogDescription>
                    Capture the work and set the ownership details before it
                    lands.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid min-h-0 gap-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
                  <div className="grid min-h-0 content-start gap-4">
                    <Field>
                      <FieldLabel htmlFor="new-task-name">Name</FieldLabel>
                      <Input
                        id="new-task-name"
                        value={name}
                        placeholder="Book venue deposit"
                        disabled={isSubmitting}
                        autoFocus
                        required
                        onChange={(event) => {
                          setName(event.currentTarget.value)
                        }}
                      />
                    </Field>

                    <MarkdownEditorField
                      id="new-task-description"
                      label="Description"
                      placeholder="Add details, links, or acceptance notes..."
                      value={description}
                      onChange={setDescription}
                      disabled={isSubmitting}
                    />
                  </div>

                  <FieldGroup className="content-start gap-3 rounded-lg border bg-muted/20 p-3">
                    <Field>
                      <FieldLabel>Parent</FieldLabel>
                      <TaskParentSelector.PropertyButton
                        className="w-full"
                        enabled={open}
                        scope={parentScope}
                        value={parent}
                        disabled={isSubmitting}
                        onChange={setParent}
                      />
                      <FieldDescription>Required</FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel>Initial status</FieldLabel>
                      <TaskStatusSelector.PropertyButton
                        className="w-full"
                        disabled={isSubmitting}
                        statusView={{
                          effectiveStatus: initialStatus,
                          isManuallyEditable: true,
                          statusOptions: [...INITIAL_STATUS_OPTIONS],
                        }}
                        onChange={(status) => {
                          if (status !== "auto") {
                            setInitialStatus(status)
                          }
                        }}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                      <Field>
                        <FieldLabel>Assignee</FieldLabel>
                        <TaskAssigneeSelector.PropertyButton
                          assignees={assigneeState}
                          scope={parentScope}
                          disabled={isSubmitting}
                          onChange={setAssigneeIds}
                        />
                      </Field>

                      <Field>
                        <FieldLabel>Owner</FieldLabel>
                        <TaskOwnerSelector.PropertyButton
                          value={owner}
                          selectedOwner={selectedOwner}
                          scope={parentScope}
                          disabled={isSubmitting}
                          onChange={setOwner}
                        />
                      </Field>

                      <Field>
                        <FieldLabel>Labels</FieldLabel>
                        <TaskLabelSelector.PropertyButton
                          value={labelIds}
                          selectedLabels={selectedLabels}
                          disabled={isSubmitting}
                          onChange={setLabelIds}
                        />
                      </Field>

                      <Field>
                        <FieldLabel>Due date</FieldLabel>
                        <TaskDateSelector.PropertyButton
                          value={dueDate}
                          disabled={isSubmitting}
                          onChange={setDueDate}
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                </div>

                {submitError !== null ? (
                  <FieldError>{submitError}</FieldError>
                ) : null}
              </div>

              <DialogFooter className="mx-0 mb-0">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={!canSubmit}>
                  {isSubmitting ? "Creating..." : "Create task"}
                </Button>
              </DialogFooter>
            </form>
          </PopoverPortalContainerProvider>
        </ComboboxPortalContainerProvider>
      </DialogContent>
    </Dialog>
  )
}
