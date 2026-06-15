import { ObjectAvatar } from "@/components/object-avatar"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { TeamName } from "@/convex/permissions/shared"
import type { PublicUser } from "@/convex/users/validators"
import { useCan } from "@/features/auth"
import { useQuery } from "convex/react"

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

export function useUserItems(
  open: boolean,
  teamName?: TeamName,
  competitionId?: Id<"competitions">
) {
  const { allowed: canReadUsers, isLoading: userAccessLoading } = useCan(
    "read",
    "User"
  )
  const globalList = useQuery(
    api.users.queries.list,
    open && competitionId === undefined && !userAccessLoading && canReadUsers
      ? teamName === undefined
        ? {}
        : { teamName }
      : "skip"
  )
  const competitionList = useQuery(
    api.users.queries.listForCompetition,
    open && competitionId !== undefined
      ? teamName === undefined
        ? { competitionId }
        : { competitionId, teamName }
      : "skip"
  )
  return competitionId === undefined ? globalList : competitionList
}
