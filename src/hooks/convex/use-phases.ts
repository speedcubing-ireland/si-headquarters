import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import type { CompetitionPhase } from "@/data/types-new";

export function usePhases(): {
	phases: CompetitionPhase[];
	isLoading: boolean;
} {
	const data = useQuery(api.phases.list, {});
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
		isLoading: data === undefined,
	};
}
