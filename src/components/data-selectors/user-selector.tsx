import { ObjectAvatar } from "@/components/object-avatar"
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { useQuery } from "convex/react"
import { UserRoundIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"
import * as DataSelector from "./data-selector"
import {
  useMultipleDataSelector,
  useSingleDataSelector,
} from "./data-selector-model"
import * as SelectorFace from "./selector-face"
import type { SelectorChangeHandler } from "./selector-options"

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

type UserFaceAppearance = "property" | "compact" | "icon"

const getUserName = (user: User) => user.name ?? "Unknown user"
const getUserId = (user: User) => user._id
const getUserValueKey = (id: UserId) => id

function getVisibleAvatarCount(userCount: number, maxAvatars?: number) {
  if (maxAvatars === undefined) {
    return Math.min(userCount, 3)
  }

  const slotCount = Math.max(1, Math.floor(maxAvatars))
  if (userCount <= slotCount) return userCount

  return slotCount - 1
}

function renderUserItem(user: User) {
  return (
    <>
      <ObjectAvatar obj={user} size="sm" />
      <span className="truncate">{getUserName(user)}</span>
    </>
  )
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

function useUserItems(open: boolean) {
  return useQuery(api.users.queries.list, open ? {} : "skip")
}

function SingleUserSelectorControl({
  avatarProps,
  className,
  disabled,
  maxAvatars,
  onChange,
  selectedUser,
  size,
  value,
  variant,
}: SingleUserSelectorProps) {
  const [open, setOpen] = useState(false)
  const users = useUserItems(open)
  const model = useSingleDataSelector<User, UserId>({
    getLabel: getUserName,
    getValue: getUserId,
    getValueKey: getUserValueKey,
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
        size={size}
        variant={variant}
      >
        <Face
          appearance="property"
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
  value,
  variant,
}: MultipleUserSelectorProps & {
  appearance: UserFaceAppearance
}) {
  const [open, setOpen] = useState(false)
  const users = useUserItems(open)
  const model = useMultipleDataSelector<User, UserId>({
    getLabel: getUserName,
    getValue: getUserId,
    getValueKey: getUserValueKey,
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
