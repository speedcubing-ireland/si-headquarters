// To-do this needs to have support for 'assignable'
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { ObjectAvatar } from "@/components/object-avatar"
import type { Button } from "@/components/ui/button"
import {
  MultipleSelectorCombobox,
  SingleSelectorCombobox,
} from "@/components/data-selectors/selector-combobox"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { useQuery } from "convex/react"
import { UserRoundIcon } from "lucide-react"
import { useState } from "react"

type User = PublicUser
type UserId = Id<"users">
type ObjectAvatarProps = Omit<React.ComponentProps<typeof ObjectAvatar>, "obj">

interface BaseUserButtonProps {
  avatarProps?: ObjectAvatarProps
  className?: string
  maxAvatars?: number
  showName?: boolean
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
}

type SingleUserButtonProps = BaseUserButtonProps & {
  selectionMode?: "single"
  selectedUser?: User | null
  value: UserId | null
  onChange: (value: UserId | null) => void
}

type MultipleUserButtonProps = BaseUserButtonProps & {
  selectionMode: "multiple"
  selectedUsers?: User[]
  value: UserId[]
  onChange: (value: UserId[]) => void
}

type UserButtonProps = SingleUserButtonProps | MultipleUserButtonProps

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

function UserButtonFace({
  avatarProps,
  maxAvatars,
  showName,
  users,
}: {
  avatarProps?: ObjectAvatarProps
  maxAvatars?: number
  showName: boolean
  users: User[]
}) {
  if (users.length === 0) {
    return (
      showName ? (
      <>
        <UserRoundIcon />
        None
      </>
    ) : (
      <Avatar
        size="sm"
        {...avatarProps}
      >
        <UserRoundIcon data-slot="avatar-image" className="p-0.75 aspect-square size-full object-fit" />
      </Avatar>
    ))
  }

  if (users.length === 1) {
    return (
      <>
        <ObjectAvatar obj={users[0]} size="sm" {...avatarProps} />
        {showName && getUserName(users[0]).split(" ")[0]}
      </>
    )
  }

  const visibleAvatarCount = getVisibleAvatarCount(users.length, maxAvatars)
  const hiddenAvatarCount = users.length - visibleAvatarCount

  return (
    <AvatarGroup>
      {users.slice(0, visibleAvatarCount).map((user) => (
        <ObjectAvatar key={user._id} obj={user} size="sm" {...avatarProps} />
      ))}
      {hiddenAvatarCount > 0 && (
        <AvatarGroupCount className={avatarProps?.className}>+{hiddenAvatarCount}</AvatarGroupCount>
      )}
    </AvatarGroup>
  )
}

export function UserButton({
  avatarProps,
  className,
  maxAvatars,
  showName = true,
  size,
  variant,
  ...props
}: UserButtonProps) {
  const [open, setOpen] = useState(false)
  const users = useQuery(api.users.queries.list, open ? {} : "skip")
  const renderFace = (selectedUsers: User[]) => (
    <UserButtonFace
      users={selectedUsers}
      avatarProps={avatarProps}
      maxAvatars={maxAvatars}
      showName={showName}
    />
  )
  const comboboxProps = {
    getLabel: getUserName,
    getValue: getUserId,
    getValueKey: getUserValueKey,
    objectNoun: "users",
    renderItem: (user: User) => (
      <>
        <ObjectAvatar obj={user} size="sm" />
        <span className="truncate">{getUserName(user)}</span>
      </>
    ),
    searchable: true,
  }

  if (props.selectionMode === "multiple") {
    return (
      <MultipleSelectorCombobox
        {...comboboxProps}
        className={className}
        items={users}
        open={open}
        renderValue={renderFace}
        selectedItems={props.selectedUsers}
        size={size}
        variant={variant}
        values={props.value}
        onOpenChange={setOpen}
        onValueChange={props.onChange}
      />
    )
  }

  return (
    <SingleSelectorCombobox
      {...comboboxProps}
      className={className}
      clearLabel="None"
      items={users}
      open={open}
      renderValue={(selectedUser) =>
        renderFace(selectedUser ? [selectedUser] : [])
      }
      selectedItem={props.selectedUser}
      size={size}
      value={props.value}
      variant={variant}
      onOpenChange={setOpen}
      onValueChange={props.onChange}
    />
  )
}
