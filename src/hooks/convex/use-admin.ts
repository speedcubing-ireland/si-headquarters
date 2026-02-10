import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const useIsDirector = () => {
	const result = useQuery(api.admin.isDirector, {});
	return { isDirector: result === true, isLoading: result === undefined };
};

export const useAdminMembersAndTeams = () => {
	const d = useQuery(api.admin.listMembersAndTeams, {});
	return {
		users: d?.users ?? [],
		teams: d?.teams ?? [],
		pendingTeamMembers: d?.pendingTeamMembers ?? [],
		isLoading: d === undefined,
	};
};

export function useAdminMemberMutations() {
	const updateTeamMembersMut = useMutation(api.admin.updateTeamMembers);
	const addPendingMut = useMutation(api.admin.addPendingTeamMember);
	const removePendingMut = useMutation(api.admin.removePendingTeamMember);
	return {
		updateTeamMembers: (teamId: Id<"teams">, memberIds: Id<"users">[]) =>
			updateTeamMembersMut({ teamId, memberIds }),
		addPendingTeamMember: (teamId: Id<"teams">, email: string) =>
			addPendingMut({ teamId, email }),
		removePendingTeamMember: (id: Id<"pendingTeamMembers">) =>
			removePendingMut({ pendingTeamMemberId: id }),
	};
}
