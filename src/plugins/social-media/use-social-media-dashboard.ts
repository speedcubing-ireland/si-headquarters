import type { FunctionReturnType } from "convex/server"
import { useAction } from "convex/react"
import { useCallback } from "react"
import { api } from "@/convex/_generated/api"
import { useAsyncLoad } from "@/features/integrations"

export type SocialMediaDashboardCompetition = FunctionReturnType<
  typeof api.plugins.socialMedia.dashboard.fetchCompetitions
>[number]

export function useSocialMediaDashboard() {
  const fetchCompetitions = useAction(
    api.plugins.socialMedia.dashboard.fetchCompetitions
  )
  const load = useCallback(
    async () => fetchCompetitions({}),
    [fetchCompetitions]
  )
  const { data, error, isFetching, hasLoaded, refresh } = useAsyncLoad(load)

  return {
    competitions: data ?? null,
    error,
    isFetching,
    hasLoaded,
    refresh,
  }
}
