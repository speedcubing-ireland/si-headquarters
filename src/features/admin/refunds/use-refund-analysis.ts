import { useAsyncLoad } from "@/features/integrations"
import type { RefundComputationResult } from "@/convex/refunds/api"

export function useRefundAnalysis(
  computeRefunds: () => Promise<RefundComputationResult>
) {
  const { data, error, isFetching, hasLoaded, refresh } =
    useAsyncLoad(computeRefunds)
  return {
    analysis: data ?? null,
    isLoading: !hasLoaded,
    isRefreshing: isFetching && hasLoaded,
    error,
    refresh,
  }
}
