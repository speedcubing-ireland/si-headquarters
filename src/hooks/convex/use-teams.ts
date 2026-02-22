import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Team } from "@/data/types-new";
import { useRetainedQueryResult } from "./use-retained-query-result";

export function useTeams(): { teams: Team[]; isLoading: boolean } {
	const teamsRawResult = useQuery(api.teams.list);
	const usersDataResult = useQuery(api.users.listUsers);
	const teamsRawState = useRetainedQueryResult(teamsRawResult);
	const usersDataState = useRetainedQueryResult(usersDataResult);
	const teamsRaw = teamsRawState.data;
	const usersData = usersDataState.data;
	const teams = useMemo(() => {
		if (teamsRaw == null || usersData == null) return [];
		const userMap = new Map(usersData.map((u) => [u.id, u]));
		return teamsRaw.map((t) => ({
			id: t._id,
			name: t.name,
			members: t.memberIds
				.map((id) => userMap.get(id))
				.filter((u): u is NonNullable<typeof u> => u != null)
				.map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl })),
		}));
	}, [teamsRaw, usersData]);
	return {
		teams,
		isLoading: teamsRawState.isLoading || usersDataState.isLoading,
	};
}
