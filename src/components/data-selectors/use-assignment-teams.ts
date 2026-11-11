import { api } from "@/convex/_generated/api"
import type { CommentTargetRef } from "@/convex/utils"
import { useCan } from "@/features/auth"
import { useQuery } from "convex-helpers/react/cache"

// Share the same team query across scopes when the caller can read teams.
// Scoped editors without that grant use the assignment endpoint instead.
export function useAssignmentTeams(open: boolean, scope?: CommentTargetRef) {
  const { allowed: canReadTeams, isLoading } = useCan("read", "Team")
  const globalTeams = useQuery(
    api.teams.queries.listForTaskFilters,
    open && !isLoading && canReadTeams ? {} : "skip"
  )
  const scopedTeams = useQuery(
    api.tasks.queries.listAssignmentTeams,
    open && !isLoading && !canReadTeams && scope !== undefined
      ? { scope }
      : "skip"
  )
  return canReadTeams ? globalTeams : scopedTeams
}
