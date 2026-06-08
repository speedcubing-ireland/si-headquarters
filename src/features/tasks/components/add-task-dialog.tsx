import * as DataSelector from "@/components/data-selectors/data-selector"
import { useSingleDataSelector } from "@/components/data-selectors/data-selector-model"
import { Dot as PhaseDot } from "@/components/data-selectors/phase-selector"
import * as SelectorFace from "@/components/data-selectors/selector-face"
import * as TaskAssigneeSelector from "@/components/data-selectors/task-assignee-selector"
import * as TaskDateSelector from "@/components/data-selectors/task-date-selector"
import type { TaskLabelOption } from "@/components/data-selectors/task-label-display"
import * as TaskLabelSelector from "@/components/data-selectors/task-label-selector"
import * as TaskOwnerSelector from "@/components/data-selectors/task-owner-selector"
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
import type { TaskViewAssignees } from "@/convex/tasks/view"
import type { PublicUser } from "@/convex/users/validators"
import { MarkdownEditorField } from "@/features/shared/markdown-editor-field"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  CassetteTapeIcon,
  CircleDotIcon,
  GitBranchIcon,
  PlusIcon,
} from "lucide-react"
import { useDeferredValue, useMemo, useState, type ReactNode } from "react"

type TaskParentRef = Doc<"tasks">["parent"]
type TaskStatus = Doc<"tasks">["status"]
type TaskAssigneeIds = Doc<"tasks">["assigneeIds"]
type TaskOwnerRef = Doc<"tasks">["owner"]
type CreationTargets = FunctionReturnType<
  typeof api.tasks.queries.listCreationTargets
>
type PhaseTarget = CreationTargets["phases"][number] & {
  targetType: "phases"
}
type TaskTarget = CreationTargets["tasks"][number] & {
  targetType: "tasks"
}
type ParentTarget = PhaseTarget | TaskTarget

const INITIAL_STATUS_OPTIONS = ["backlog", "to-do", "in-progress"] as const

function parentValueKey(value: TaskParentRef) {
  return `${value.type}:${value.id}`
}

function parentTargetValue(target: ParentTarget): TaskParentRef {
  if (target.targetType === "phases") {
    return { type: "phases", id: target._id }
  }

  return { type: "tasks", id: target._id }
}

function renderPhaseTarget(target: PhaseTarget) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <PhaseDot className="size-2.5 shrink-0" color={target.color} />
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate">{target.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {target.competitionName}
        </span>
      </span>
    </div>
  )
}

function renderTaskTarget(target: TaskTarget) {
  const Icon = target.kind === "flow" ? CassetteTapeIcon : CircleDotIcon

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate">{target.pathLabel}</span>
        <span className="truncate text-xs text-muted-foreground">
          {target.contextLabel}
        </span>
      </span>
    </div>
  )
}

function getParentTargetLabel(target: ParentTarget) {
  if (target.targetType === "phases") {
    return `${target.competitionName} ${target.name}`
  }

  return `${target.pathLabel} ${target.contextLabel}`
}

function renderParentTarget(target: ParentTarget) {
  return target.targetType === "phases"
    ? renderPhaseTarget(target)
    : renderTaskTarget(target)
}

function TaskParentFace({
  target,
  value,
}: {
  target: ParentTarget | null
  value: TaskParentRef | null
}) {
  if (target?.targetType === "phases") {
    return (
      <SelectorFace.Root>
        <PhaseDot className="size-3" color={target.color} />
        <SelectorFace.Text>{target.name}</SelectorFace.Text>
      </SelectorFace.Root>
    )
  }

  if (target?.targetType === "tasks") {
    const Icon = target.kind === "flow" ? CassetteTapeIcon : CircleDotIcon
    return (
      <SelectorFace.Root>
        <Icon className="size-4" />
        <SelectorFace.Text>{target.pathLabel}</SelectorFace.Text>
      </SelectorFace.Root>
    )
  }

  if (value !== null) {
    return (
      <SelectorFace.Empty icon={GitBranchIcon}>
        Selected parent
      </SelectorFace.Empty>
    )
  }

  return (
    <SelectorFace.Empty icon={GitBranchIcon}>Select parent</SelectorFace.Empty>
  )
}

function TaskParentSelector({
  disabled,
  enabled,
  value,
  onChange,
}: {
  disabled?: boolean
  enabled: boolean
  value: TaskParentRef | null
  onChange: (value: TaskParentRef | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const targets = useQuery(
    api.tasks.queries.listCreationTargets,
    enabled ? { search: deferredSearchQuery, selectedParent: value } : "skip"
  )
  const phaseTargets = useMemo<PhaseTarget[] | undefined>(
    () =>
      targets?.phases.map((target) => ({
        ...target,
        targetType: "phases" as const,
      })),
    [targets?.phases]
  )
  const taskTargets = useMemo<TaskTarget[] | undefined>(
    () =>
      targets?.tasks.map((target) => ({
        ...target,
        targetType: "tasks" as const,
      })),
    [targets?.tasks]
  )
  const groups = useMemo(
    () => [
      {
        key: "phases",
        label: "Phases",
        items: phaseTargets,
        getLabel: getParentTargetLabel,
        getValue: parentTargetValue,
        renderItem: renderParentTarget,
      },
      {
        key: "tasks",
        label: "Tasks",
        items: taskTargets,
        getLabel: getParentTargetLabel,
        getValue: parentTargetValue,
        renderItem: renderParentTarget,
      },
    ],
    [phaseTargets, taskTargets]
  )
  const model = useSingleDataSelector<ParentTarget, TaskParentRef>({
    getValueKey: parentValueKey,
    groups,
    selectedItem: null,
    value,
  })

  return (
    <DataSelector.SingleRoot
      model={model}
      open={open}
      searchable
      searchQuery={searchQuery}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSearchQuery("")
      }}
      onSearchChange={setSearchQuery}
      onValueChange={onChange}
    >
      <DataSelector.ButtonTrigger
        className="w-full"
        disabled={disabled}
        variant="outline"
      >
        <TaskParentFace target={model.selectedItem} value={value} />
      </DataSelector.ButtonTrigger>
      <DataSelector.Content
        align="start"
        loading={targets === undefined}
        model={model}
        objectNoun="parents"
        searchable
      />
    </DataSelector.SingleRoot>
  )
}

function buildAssigneeState(
  value: TaskAssigneeIds,
  users: PublicUser[] | undefined
): TaskViewAssignees {
  if (value === "assignable") {
    return {
      mode: "assignable",
      count: 0,
      userIds: [],
      primaryUser: null,
      users: [],
    }
  }

  if (value === null || value.length === 0) {
    return {
      mode: "none",
      count: 0,
      userIds: [],
      primaryUser: null,
      users: [],
    }
  }

  const userById = new Map((users ?? []).map((user) => [user._id, user]))
  const selectedUsers = value
    .map((userId) => userById.get(userId))
    .filter((user): user is PublicUser => user !== undefined)

  return {
    mode: "assigned",
    count: value.length,
    userIds: value,
    primaryUser: selectedUsers[0] ?? null,
    users: selectedUsers,
  }
}

function selectedOwnerFromValue(
  value: TaskOwnerRef,
  users: PublicUser[] | undefined,
  teams: { _id: Id<"teams">; name: string }[] | undefined,
  fallback: TaskOwnerSelector.SelectedOwner | null | undefined
): TaskOwnerSelector.SelectedOwner | null {
  if (value === null) return null

  if (
    fallback !== null &&
    fallback !== undefined &&
    fallback.type === value.type &&
    fallback._id === value.id
  ) {
    return fallback
  }

  if (value.type === "users") {
    const user = users?.find((entry) => entry._id === value.id)
    return user ? { ...user, type: "users" } : null
  }

  const team = teams?.find((entry) => entry._id === value.id)
  return team ? { ...team, type: "teams" } : null
}

export function AddTaskDialog({
  children,
  defaultOwner = null,
  defaultOwnerDisplay,
  initialParent = null,
}: {
  children?: ReactNode
  defaultOwner?: TaskOwnerRef
  defaultOwnerDisplay?: TaskOwnerSelector.SelectedOwner | null
  initialParent?: TaskParentRef | null
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
  const [owner, setOwner] = useState<TaskOwnerRef>(defaultOwner)
  const [labelIds, setLabelIds] = useState<Id<"taskLabels">[]>([])
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const users = useQuery(api.users.queries.list, open ? {} : "skip")
  const teams = useQuery(
    api.teams.queries.listForTaskFilters,
    open ? {} : "skip"
  )
  const labels = useQuery(api.tasks.labels.queries.list, open ? {} : "skip")

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
    () => buildAssigneeState(assigneeIds, users),
    [assigneeIds, users]
  )
  const selectedOwner = useMemo(
    () => selectedOwnerFromValue(owner, users, teams, defaultOwnerDisplay),
    [defaultOwnerDisplay, owner, teams, users]
  )

  const resetForm = () => {
    setName("")
    setDescription("")
    setParent(initialParent)
    setInitialStatus("backlog")
    setAssigneeIds(null)
    setOwner(defaultOwner)
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
      <DialogContent className="top-[max(1rem,calc(50svh_-_24rem))] right-4 left-4 max-h-[calc(100svh-2rem)] w-auto max-w-none translate-x-0 translate-y-0 overflow-visible p-0 sm:right-[max(1rem,calc(50%_-_21rem))] sm:left-[max(1rem,calc(50%_-_21rem))] sm:max-w-none">
        <div
          ref={setPortalContainer}
          className="pointer-events-none fixed inset-0 z-[60]"
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
                      <TaskParentSelector
                        enabled={open}
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
                          disabled={isSubmitting}
                          onChange={setAssigneeIds}
                        />
                      </Field>

                      <Field>
                        <FieldLabel>Owner</FieldLabel>
                        <TaskOwnerSelector.PropertyButton
                          value={owner}
                          selectedOwner={selectedOwner}
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
