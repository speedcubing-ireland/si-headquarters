import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { cn } from "@/lib/utils"
import { useQuery } from "convex/react"
import { UserRoundIcon } from "lucide-react"
import type { ReactNode } from "react"

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
const isSameUser = (item: User, value: User) => item._id === value._id

function getUserInitials(user: User) {
  const initials = getUserName(user)
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return initials || "?"
}

function UserAvatar({ user }: { user: User }) {
  return (
    <Avatar size="sm">
      <AvatarImage src={user.image ?? undefined} alt={getUserName(user)} />
      <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
    </Avatar>
  )
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

function UserButtonTrigger({
  className,
  users,
}: BaseUserButtonProps & {
  users: User[]
}) {
  return (
    <ComboboxTrigger
      showChevron={false}
      render={
        <Button variant="outline" className={cn("justify-start", className)} />
      }
    >
      <UserButtonFace users={users} />
    </ComboboxTrigger>
  )
}

function UserButtonContent({
  users,
  children,
}: {
  users: User[] | undefined
  children?: ReactNode
}) {
  return (
    <ComboboxContent className="w-64 p-0" align="end">
      <ComboboxInput
        placeholder="Search users..."
        showClear={false}
        showTrigger={false}
      />
      <ComboboxEmpty>
        {users ? "No users found." : "Loading users..."}
      </ComboboxEmpty>
      <ComboboxList>
        {children}
        <ComboboxCollection>
          {(user: User) => (
            <ComboboxItem key={user._id} value={user}>
              <UserAvatar user={user} />
              <span className="truncate">{getUserName(user)}</span>
            </ComboboxItem>
          )}
        </ComboboxCollection>
      </ComboboxList>
    </ComboboxContent>
  )
}

export function UserButton(props: UserButtonProps) {
  const users = useQuery(api.users.queries.list)
  const selectedIds = [props.value]
    .flat()
    .filter((id): id is Id<"users"> => Boolean(id))
  const selectedUsers =
    users?.filter((user) => selectedIds.includes(user._id)) ?? []
  const comboboxProps = {
    items: users ?? [],
    itemToStringLabel: getUserName,
    isItemEqualToValue: isSameUser,
  }
  const trigger = (
    <UserButtonTrigger className={props.className} users={selectedUsers} />
  )

  if (props.selectionMode === "multiple") {
    return (
      <Combobox<User, true>
        {...comboboxProps}
        multiple
        value={selectedUsers}
        onValueChange={(nextUsers) =>
          props.onChange(nextUsers.map((user) => user._id))
        }
      >
        {trigger}
        <UserButtonContent users={users} />
      </Combobox>
    )
  }

  return (
    <Combobox<User>
      {...comboboxProps}
      value={selectedUsers[0] ?? null}
      onValueChange={(user) => props.onChange(user?._id ?? null)}
    >
      {trigger}
      <UserButtonContent users={users}>
        <ComboboxItem value={null}>None</ComboboxItem>
        <ComboboxSeparator />
      </UserButtonContent>
    </Combobox>
  )
}
