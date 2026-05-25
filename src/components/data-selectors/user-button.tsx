import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { ObjectAvatar } from "@/components/object-avatar"
import { Button } from "@/components/ui/button"
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

type BaseUserButtonProps = {
  className?: string
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

function UserAvatar({ user }: { user: User }) {
  return <ObjectAvatar obj={user} size="sm" />
}

function UserButtonFace({ users }: { users: User[] }) {
  if (users.length === 0) {
    return (
      <>
        <UserRoundIcon />
        None
      </>
    )
  }

  if (users.length === 1) {
    return (
      <>
        <UserAvatar user={users[0]} />
        {getUserName(users[0]).split(" ")[0]}
      </>
    )
  }

  return (
    <>
      <AvatarGroup>
        {users.slice(0, 3).map((user) => (
          <UserAvatar key={user._id} user={user} />
        ))}
        {users.length > 3 && (
          <AvatarGroupCount>+{users.length - 3}</AvatarGroupCount>
        )}
      </AvatarGroup>
    </>
  )
}

function UserItem({ user }: { user: User }) {
  return (
    <>
      <UserAvatar user={user} />
      <span className="truncate">{getUserName(user)}</span>
    </>
  )
}

export function UserButton(props: UserButtonProps) {
  const [open, setOpen] = useState(false)
  const users = useQuery(api.users.queries.list, open ? {} : "skip")
  const comboboxProps = {
    getLabel: getUserName,
    getValue: getUserId,
    getValueKey: getUserValueKey,
    objectNoun: "users",
    renderItem: (user: User) => <UserItem user={user} />,
    searchable: true,
  }

  if (props.selectionMode === "multiple") {
    return (
      <MultipleSelectorCombobox
        {...comboboxProps}
        className={props.className}
        items={users}
        open={open}
        renderValue={(selectedUsers) => (
          <UserButtonFace users={selectedUsers} />
        )}
        selectedItems={props.selectedUsers}
        size={props.size}
        variant={props.variant}
        values={props.value}
        onOpenChange={setOpen}
        onValueChange={props.onChange}
      />
    )
  }

  return (
    <SingleSelectorCombobox
      {...comboboxProps}
      className={props.className}
      clearLabel="None"
      items={users}
      open={open}
      renderValue={(selectedUser) => (
        <UserButtonFace users={selectedUser ? [selectedUser] : []} />
      )}
      selectedItem={props.selectedUser}
      size={props.size}
      value={props.value}
      variant={props.variant}
      onOpenChange={setOpen}
      onValueChange={props.onChange}
    />
  )
}
