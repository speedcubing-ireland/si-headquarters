import * as DataSelector from "@/components/data-selectors/data-selector"
import { useMultipleDataSelector } from "@/components/data-selectors/data-selector-model"
import * as SelectorFace from "@/components/data-selectors/selector-face"
import * as UserSelector from "@/components/data-selectors/user-selector"
import {
  getUserName,
  renderUserItem,
  useUserItems,
  type UserFaceAppearance,
} from "@/components/data-selectors/user-selector-model"
import type { ObjectAvatar } from "@/components/object-avatar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import type { TaskViewAssignees } from "@/convex/tasks/view"
import { useMemo, useState, type ComponentProps } from "react"

type AssigneeValue = Exclude<Doc<"tasks">["assigneeIds"], null>
type ObjectAvatarProps = Omit<ComponentProps<typeof ObjectAvatar>, "obj">
type SelectorButtonProps = ComponentProps<typeof DataSelector.ButtonTrigger>

interface TaskAssigneeSelectorProps extends Pick<
  SelectorButtonProps,
  "className" | "disabled" | "size" | "variant"
> {
  assignees: TaskViewAssignees
  avatarProps?: ObjectAvatarProps
  maxAvatars?: number
  onChange: (value: AssigneeValue) => void
}

function AssignableFace({
  appearance,
  avatarProps,
}: {
  appearance: UserFaceAppearance
  avatarProps?: ObjectAvatarProps
}) {
  if (appearance === "icon") {
    return (
      <Avatar size="sm" {...avatarProps}>
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
    )
  }

  return <SelectorFace.Empty>Assignable</SelectorFace.Empty>
}

function AssigneeFace({
  appearance,
  assignees,
  avatarProps,
  maxAvatars,
}: {
  appearance: UserFaceAppearance
  assignees: TaskViewAssignees
  avatarProps?: ObjectAvatarProps
  maxAvatars?: number
}) {
  if (assignees.mode === "assignable") {
    return <AssignableFace appearance={appearance} avatarProps={avatarProps} />
  }

  return (
    <UserSelector.Face
      appearance={appearance}
      avatarProps={avatarProps}
      maxAvatars={maxAvatars}
      users={assignees.users}
    />
  )
}

function TaskAssigneeSelectorControl({
  appearance,
  assignees,
  avatarProps,
  className,
  disabled,
  maxAvatars,
  onChange,
  size,
  variant,
}: TaskAssigneeSelectorProps & {
  appearance: UserFaceAppearance
}) {
  const [open, setOpen] = useState(false)
  const users = useUserItems(open)
  const model = useMultipleDataSelector<PublicUser, Id<"users">>({
    getLabel: getUserName,
    getValue: (user) => user._id,
    getValueKey: (id) => id,
    items: users,
    renderItem: renderUserItem,
    selectedItems: assignees.users,
    values: assignees.userIds,
  })

  const headerActions = useMemo(
    (): DataSelector.HeaderAction[] => [
      {
        key: "none",
        label: "None",
        selected: assignees.mode === "none",
        onSelect: () => {
          onChange([])
          setOpen(false)
        },
      },
      {
        key: "assignable",
        label: "Assignable",
        selected: assignees.mode === "assignable",
        onSelect: () => {
          onChange("assignable")
          setOpen(false)
        },
      },
    ],
    [assignees.mode, onChange]
  )

  return (
    <DataSelector.MultipleRoot
      model={model}
      open={open}
      searchable
      onOpenChange={setOpen}
      onValueChange={(userIds) => {
        onChange(userIds)
      }}
    >
      <DataSelector.ButtonTrigger
        className={className}
        disabled={disabled}
        iconOnly={appearance === "icon"}
        size={size}
        variant={variant}
      >
        <AssigneeFace
          appearance={appearance}
          assignees={assignees}
          avatarProps={avatarProps}
          maxAvatars={maxAvatars}
        />
      </DataSelector.ButtonTrigger>
      <DataSelector.Content
        headerActions={headerActions}
        model={model}
        objectNoun="users"
        searchable
      />
    </DataSelector.MultipleRoot>
  )
}

export function PropertyButton(props: TaskAssigneeSelectorProps) {
  return <TaskAssigneeSelectorControl appearance="property" {...props} />
}

export function CompactButton({
  size = "sm",
  ...props
}: TaskAssigneeSelectorProps) {
  return (
    <TaskAssigneeSelectorControl appearance="compact" size={size} {...props} />
  )
}

export function IconButton({
  maxAvatars = 1,
  variant = "icon",
  ...props
}: TaskAssigneeSelectorProps) {
  return (
    <TaskAssigneeSelectorControl
      appearance="icon"
      maxAvatars={maxAvatars}
      variant={variant}
      {...props}
    />
  )
}
