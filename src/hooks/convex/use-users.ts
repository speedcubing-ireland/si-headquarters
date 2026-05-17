import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { User } from "@/data/types-new";
import { useRetainedQueryResult } from "./use-retained-query-result";

export function useUsers(): { users: User[]; isLoading: boolean } {
	const result = useQuery(api.core.users.listUsers);
	const { data, isLoading } = useRetainedQueryResult(result);
	return {
		users: data ?? [],
		isLoading,
	};
}
