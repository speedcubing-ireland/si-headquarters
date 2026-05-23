import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { ObjectAvatar } from "@/components/object-avatar"
import {
  MultipleSelectorCombobox,
  SingleSelectorCombobox,
} from "@/components/data-selectors/selector-combobox"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { useQuery } from "convex/react"
import { UserRoundIcon } from "lucide-react"

type User = PublicUser

type BaseUserButtonProps = {
  className?: string
}

type SingleUserButtonProps = BaseUserButtonProps & {
  selectionMode?: "single"
  value: Id<"users"> | null
  onChange: (value: Id<"users"> | null) => void
}

type MultipleUserButtonProps = BaseUserButtonProps & {
  selectionMode: "multiple"
  value: Id<"users">[]
  onChange: (value: Id<"users">[]) => void
}

type UserButtonProps = SingleUserButtonProps | MultipleUserButtonProps

const getUserName = (user: User) => user.name ?? "Unknown user"

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
  const users = useQuery(api.users.queries.list)
  const comboboxProps = {
    getLabel: getUserName,
    getValue: (user: User) => user._id,
    getValueKey: (id: Id<"users">) => id,
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
        renderValue={(selectedUsers) => (
          <UserButtonFace users={selectedUsers} />
        )}
        values={props.value}
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
      renderValue={(selectedUser) => (
        <UserButtonFace users={selectedUser ? [selectedUser] : []} />
      )}
      value={props.value}
      onValueChange={props.onChange}
    />
  )
}
