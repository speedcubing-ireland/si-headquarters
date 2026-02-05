import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { User } from "@/data/types-new";

export function useUsers(): { users: User[]; isLoading: boolean } {
	const data = useQuery(api.users.listUsers);
	return {
		users: (data ?? []) as User[],
		isLoading: data === undefined,
	};
}
