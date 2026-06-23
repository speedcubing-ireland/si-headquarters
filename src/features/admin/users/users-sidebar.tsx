import { PlusIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { PageListMessage } from "@/components/layout/page-list-message"
import { ObjectAvatar } from "@/components/object-avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AddUserDialog } from "@/features/admin/users/add-user-dialog"
import type { AdminUser } from "@/features/admin/users/utils"
import { userDisplayName } from "@/features/admin/users/utils"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

function matchesUserQuery(user: AdminUser, query: string) {
  const normalized = query.trim().toLowerCase()
  if (normalized.length === 0) {
    return true
  }
  const name = userDisplayName(user).toLowerCase()
  const email = user.email?.toLowerCase() ?? ""
  return name.includes(normalized) || email.includes(normalized)
}

export function UsersSidebar({
  users,
  selectedUserId,
  onSelectUser,
  onUserCreated,
  className,
}: {
  users: AdminUser[]
  selectedUserId: Id<"users"> | null
  onSelectUser: (userId: Id<"users">) => void
  onUserCreated: (userId: Id<"users">) => void
  className?: string
}) {
  const [query, setQuery] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const filteredUsers = useMemo(
    () => users.filter((user) => matchesUserQuery(user, query)),
    [query, users]
  )

  return (
    <Card
      size="sm"
      className={cn(
        "flex min-h-0 flex-col",
        "max-md:max-h-[min(24rem,50vh)]",
        className
      )}
    >
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Add user"
            onClick={() =>{  setAddDialogOpen(true); }}
          >
            <PlusIcon className="size-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            placeholder="Search users…"
            aria-label="Search users"
          />
        </InputGroup>
        <ScrollArea className="min-h-0 flex-1">
          {filteredUsers.length === 0 ? (
            <PageListMessage className="py-6">
              No users match your search.
            </PageListMessage>
          ) : (
            <div className="flex flex-col gap-0.5 pr-3">
              {filteredUsers.map((user) => {
                const active = selectedUserId === user._id
                return (
                  <Button
                    key={user._id}
                    type="button"
                    variant={active ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start gap-3 px-2 py-2 font-normal"
                    onClick={() => {
                      onSelectUser(user._id)
                    }}
                  >
                    <ObjectAvatar
                      obj={{
                        _id: user._id,
                        name: user.name,
                        image: user.image,
                      }}
                      avatarUrl={user.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium">
                        {userDisplayName(user)}
                      </span>
                      {user.disabled ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          Disabled
                        </span>
                      ) : user.email !== undefined && user.email.length > 0 ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      ) : null}
                    </span>
                  </Button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <AddUserDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreated={onUserCreated}
      />
    </Card>
  )
}
