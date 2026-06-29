import { api } from "@/convex/_generated/api"
import { useAsyncLoad } from "@/features/integrations"
import { useAction } from "convex/react"
import { useCallback } from "react"

export function useEventReport() {
  const loadReport = useAction(api.events.actions.loadReport)
  const load = useCallback(() => loadReport({}), [loadReport])
  const refreshLoad = useCallback(
    () => loadReport({ skipCache: true }),
    [loadReport]
  )
  const { data, error, isFetching, hasLoaded, refresh } = useAsyncLoad(load, {
    clearDataOnError: false,
    refreshLoad,
  })

  return {
    rows: data ?? null,
    error,
    isLoading: isFetching && !hasLoaded,
    isRefreshing: isFetching && hasLoaded,
    refresh,
  }
}
