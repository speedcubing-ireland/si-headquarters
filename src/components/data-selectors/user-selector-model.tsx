import { ObjectAvatar } from "@/components/object-avatar"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { CommentTargetRef } from "@/convex/utils"
import { objectRefKey } from "@/lib/utils"
import { resolveUserItems } from "./user-items"
import type { TeamName } from "@/convex/permissions/shared"
import type { PublicUser } from "@/convex/users/validators"
import { useCan } from "@/features/auth"
import { useQuery } from "convex/react"
import {
  usePaginatedQuery,
  useQuery as useCachedQuery,
} from "convex-helpers/react/cache"
import { useEffect, useState } from "react"

export type UserFaceAppearance = "property" | "compact" | "icon"

export const getUserName = (user: PublicUser) => user.name ?? "Unknown user"

export function renderUserItem(user: PublicUser) {
  return (
    <>
      <ObjectAvatar obj={user} size="sm" />
      <span className="truncate">{getUserName(user)}</span>
    </>
  )
}

const PAGE_SIZE = 50

export function useUserItems({
  open,
  scope,
  teamName,
  selectedIds,
  selectedUsers = [],
}: {
  open: boolean
  scope?: CommentTargetRef
  teamName?: TeamName
  selectedIds: Id<"users">[]
  selectedUsers?: PublicUser[]
}) {
  const [searchQuery, onSearchChange] = useState("")
  const { allowed: canReadUsers, isLoading } = useCan("read", "User")
  const enabled = scope !== undefined || (!isLoading && canReadUsers)
  const { results, status, loadMore } = usePaginatedQuery(
    api.users.queries.list,
    open && !isLoading && enabled
      ? { scope: canReadUsers ? undefined : scope, teamName }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  )
  const needsOrganisers =
    scope !== undefined && scope.type !== "projects" && teamName === undefined
  const organisers = useCachedQuery(
    api.users.queries.listScopeOrganisers,
    open && needsOrganisers ? { scope } : "skip"
  )
  // Search filters the client-side options. Continue bounded membership pages
  // while searching so a name beyond the first page can still be found.
  useEffect(() => {
    if (open && searchQuery.trim().length > 0 && status === "CanLoadMore") {
      loadMore(PAGE_SIZE)
    }
  }, [open, searchQuery, status, loadMore])
  const suppliedIds = new Set(selectedUsers.map((user) => user._id))
  const missingIds = selectedIds.filter((id) => !suppliedIds.has(id))
  const selected = useQuery(
    api.users.queries.getSelected,
    enabled && missingIds.length > 0 ? { scope, userIds: missingIds } : "skip"
  )
  const currentUser = useQuery(api.users.queries.currentUser)
  const key = `${scope === undefined ? "global" : objectRefKey(scope)}:${teamName ?? ""}`
  const [retained, setRetained] = useState<{
    key: string
    users: PublicUser[]
  }>({ key, users: [] })
  const resolved = resolveUserItems({
    available:
      open && status !== "LoadingFirstPage"
        ? [...results, ...(organisers ?? [])]
        : undefined,
    knownUsers: [
      ...(retained.key === key && selected === undefined ? retained.users : []),
      ...(selected ?? []),
      ...selectedUsers,
    ],
    selectedIds,
    currentUserId: currentUser?._id,
  })
  // Merge partial responses while labels load, retaining only current selections.
  // Compare values because callers may recreate their selected records each render.
  if (
    retained.key !== key ||
    retained.users.length !== resolved.selectedUsers.length ||
    resolved.selectedUsers.some((user, index) => {
      const previous = retained.users[index]
      return (
        user._id !== previous._id ||
        user.name !== previous.name ||
        user.image !== previous.image
      )
    })
  ) {
    setRetained({ key, users: resolved.selectedUsers })
  }
  return {
    ...resolved,
    search: { searchQuery, onSearchChange },
    loading:
      open &&
      (status === "LoadingFirstPage" ||
        (needsOrganisers && organisers === undefined) ||
        (searchQuery.trim().length > 0 && status !== "Exhausted")),
    pagination:
      status === "CanLoadMore" || status === "LoadingMore"
        ? {
            loading: status === "LoadingMore",
            onLoadMore: () => {
              loadMore(PAGE_SIZE)
            },
          }
        : undefined,
  }
}
