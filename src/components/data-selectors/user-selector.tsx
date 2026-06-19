import { ObjectAvatar } from "@/components/object-avatar"
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import type { Id } from "@/convex/_generated/dataModel"
import type { TeamName } from "@/convex/permissions/shared"
import type { PublicUser } from "@/convex/users/validators"
import { UserRoundIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"
import * as DataSelector from "./data-selector"
import {
  useMultipleDataSelector,
  useSingleDataSelector,
} from "./data-selector-model"
import * as SelectorFace from "./selector-face"
import type { SelectorChangeHandler } from "./selector-options"
import {
  getUserName,
  renderUserItem,
  useUserItems,
  type UserFaceAppearance,
} from "./user-selector-model"

type User = PublicUser
type UserId = Id<"users">
type ObjectAvatarProps = Omit<ComponentProps<typeof ObjectAvatar>, "obj">
type SelectorButtonProps = ComponentProps<typeof DataSelector.ButtonTrigger>

interface UserSelectorBaseProps extends Pick<
  SelectorButtonProps,
  "className" | "disabled" | "size" | "variant"
> {
  avatarProps?: ObjectAvatarProps
  maxAvatars?: number
  teamName?: TeamName
  competitionId?: Id<"competitions">
}

interface SingleUserSelectorProps extends UserSelectorBaseProps {
  selectedUser?: User | null
  value: UserId | null
  onChange: SelectorChangeHandler<UserId | null>
}

interface MultipleUserSelectorProps extends UserSelectorBaseProps {
  selectedUsers?: User[]
  value: UserId[]
  onChange: SelectorChangeHandler<UserId[]>
}

function getVisibleAvatarCount(userCount: number, maxAvatars?: number) {
  if (maxAvatars === undefined) {
    return Math.min(userCount, 3)
  }

  const slotCount = Math.max(1, Math.floor(maxAvatars))
  if (userCount <= slotCount) return userCount

  return slotCount - 1
}

function EmptyUserFace({
  appearance,
  avatarProps,
}: {
  appearance: UserFaceAppearance
  avatarProps?: ObjectAvatarProps
}) {
  if (appearance === "icon") {
    return (
      <Avatar size="sm" {...avatarProps}>
        <UserRoundIcon
          data-slot="avatar-image"
          className="object-fit aspect-square size-full p-0.75"
        />
      </Avatar>
    )
  }

  return <SelectorFace.Empty icon={UserRoundIcon}>None</SelectorFace.Empty>
}

export function Face({
  appearance,
  avatarProps,
  maxAvatars,
  users,
}: {
  appearance: UserFaceAppearance
  avatarProps?: ObjectAvatarProps
  maxAvatars?: number
  users: User[]
}) {
  if (users.length === 0) {
    return <EmptyUserFace appearance={appearance} avatarProps={avatarProps} />
  }

  if (users.length === 1) {
    return (
      <SelectorFace.Root>
        <ObjectAvatar obj={users[0]} size="sm" {...avatarProps} />
        {appearance !== "icon" && (
          <SelectorFace.Text>
            {getUserName(users[0]).split(" ")[0]}
          </SelectorFace.Text>
        )}
      </SelectorFace.Root>
    )
  }

  const visibleAvatarCount = getVisibleAvatarCount(users.length, maxAvatars)
  const hiddenAvatarCount = users.length - visibleAvatarCount

  return (
    <SelectorFace.Root>
      <AvatarGroup>
        {users.slice(0, visibleAvatarCount).map((user) => (
          <ObjectAvatar key={user._id} obj={user} size="sm" {...avatarProps} />
        ))}
        {hiddenAvatarCount > 0 && (
          <AvatarGroupCount className={avatarProps?.className}>
            +{hiddenAvatarCount}
          </AvatarGroupCount>
        )}
      </AvatarGroup>
    </SelectorFace.Root>
  )
}

function SingleUserSelectorControl({
  appearance = "property",
  avatarProps,
  className,
  disabled,
  maxAvatars,
  onChange,
  selectedUser,
  size,
  teamName,
  competitionId,
  value,
  variant,
}: SingleUserSelectorProps & {
  appearance?: UserFaceAppearance
}) {
  const [open, setOpen] = useState(false)
  const users = useUserItems(open, teamName, competitionId)
  const model = useSingleDataSelector<User, UserId>({
    getLabel: getUserName,
    getValue: (user) => user._id,
    getValueKey: (id) => id,
    items: users,
    renderItem: renderUserItem,
    selectedItem: selectedUser,
    value,
  })

  return (
    <DataSelector.SingleRoot
      model={model}
      open={open}
      searchable
      onOpenChange={setOpen}
      onValueChange={(userId) => {
        onChange(userId)
      }}
    >
      <DataSelector.ButtonTrigger
        className={className}
        disabled={disabled}
        iconOnly={appearance === "icon"}
        size={size}
        variant={variant}
      >
        <Face
          appearance={appearance}
          avatarProps={avatarProps}
          maxAvatars={maxAvatars}
          users={model.selectedItem ? [model.selectedItem] : []}
        />
      </DataSelector.ButtonTrigger>
      <DataSelector.Content
        clearLabel="None"
        model={model}
        objectNoun="users"
        searchable
      />
    </DataSelector.SingleRoot>
  )
}

function MultipleUserSelectorControl({
  appearance,
  avatarProps,
  className,
  disabled,
  maxAvatars,
  onChange,
  selectedUsers,
  size,
  teamName,
  competitionId,
  value,
  variant,
}: MultipleUserSelectorProps & {
  appearance: UserFaceAppearance
}) {
  const [open, setOpen] = useState(false)
  const users = useUserItems(open, teamName, competitionId)
  const model = useMultipleDataSelector<User, UserId>({
    getLabel: getUserName,
    getValue: (user) => user._id,
    getValueKey: (id) => id,
    items: users,
    renderItem: renderUserItem,
    selectedItems: selectedUsers,
    values: value,
  })

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
        <Face
          appearance={appearance}
          avatarProps={avatarProps}
          maxAvatars={maxAvatars}
          users={model.selectedItems}
        />
      </DataSelector.ButtonTrigger>
      <DataSelector.Content model={model} objectNoun="users" searchable />
    </DataSelector.MultipleRoot>
  )
}

export function SinglePropertyButton(props: SingleUserSelectorProps) {
  return <SingleUserSelectorControl {...props} />
}

export function SingleIconButton({
  variant = "icon",
  ...props
}: SingleUserSelectorProps) {
  return (
    <SingleUserSelectorControl appearance="icon" variant={variant} {...props} />
  )
}

export function MultiPropertyButton(props: MultipleUserSelectorProps) {
  return <MultipleUserSelectorControl appearance="property" {...props} />
}

export function MultiCompactButton({
  size = "sm",
  ...props
}: MultipleUserSelectorProps) {
  return (
    <MultipleUserSelectorControl appearance="compact" size={size} {...props} />
  )
}

export function MultiIconButton({
  maxAvatars = 1,
  variant = "icon",
  ...props
}: MultipleUserSelectorProps) {
  return (
    <MultipleUserSelectorControl
      appearance="icon"
      maxAvatars={maxAvatars}
      variant={variant}
      {...props}
    />
  )
}
