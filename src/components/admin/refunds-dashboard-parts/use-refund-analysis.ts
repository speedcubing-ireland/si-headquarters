import { useCallback, useEffect, useState } from "react";
import type { RefundComputationResult } from "@/convex/refunds";
import { getErrorMessage } from "@/lib/utils";

export function useRefundAnalysis(computeRefunds: () => Promise<unknown>) {
	const [analysis, setAnalysis] = useState<RefundComputationResult | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);

	const load = useCallback(
		async (mode: "initial" | "refresh" = "initial") => {
			if (mode === "initial") {
				setIsLoading(true);
			} else {
				setIsRefreshing(true);
			}
			setError(null);
			try {
				const result = await computeRefunds();
				setAnalysis(result as RefundComputationResult);
			} catch (err) {
				setAnalysis(null);
				setError(getErrorMessage(err));
			} finally {
				setIsLoading(false);
				setIsRefreshing(false);
			}
		},
		[computeRefunds],
	);

	useEffect(() => {
		void load("initial");
	}, [load]);

	const refresh = useCallback(() => load("refresh"), [load]);

	return { analysis, isLoading, isRefreshing, error, refresh };
}
