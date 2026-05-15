import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { CompetitionPhase } from "@/data/types-new";
import { useRetainedQueryResult } from "./use-retained-query-result";

export function usePhases(): {
	phases: CompetitionPhase[];
	isLoading: boolean;
} {
	const result = useQuery(api.core.phases.list, {});
	const { data, isLoading } = useRetainedQueryResult(result);
	const phases = useMemo<CompetitionPhase[]>(
		() =>
			(data ?? []).map((p) => ({
				id: p._id,
				name: p.name,
				description: p.description,
			})),
		[data],
	);
	return {
		phases,
		isLoading,
	};
}
