import type { Id } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"

// A selected ID always has an option, including while its label is loading or
// after its account is deleted. Missing labels must never erase selections.
export function resolveUserItems({
  available,
  knownUsers,
  selectedIds,
  currentUserId,
}: {
  available: PublicUser[] | undefined
  knownUsers: PublicUser[]
  selectedIds: Id<"users">[]
  currentUserId?: Id<"users">
}) {
  const byId = new Map(knownUsers.map((user) => [user._id, user]))
  for (const user of available ?? []) byId.set(user._id, user)
  const selectedUsers = selectedIds.map((id) => byId.get(id) ?? { _id: id })
  const options = new Map(selectedUsers.map((user) => [user._id, user]))
  for (const user of available ?? []) options.set(user._id, user)
  const items =
    available === undefined
      ? undefined
      : [...options.values()].sort((left, right) => {
          if (left._id === right._id) return 0
          if (left._id === currentUserId) return -1
          if (right._id === currentUserId) return 1
          return (left.name ?? "Unknown user").localeCompare(
            right.name ?? "Unknown user"
          )
        })
  return { items, selectedUsers }
}
