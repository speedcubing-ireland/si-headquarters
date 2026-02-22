import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const DEFAULT_PERMISSION_SNAPSHOT = {
	isDirector: false,
	isDelegate: false,
	isVolunteer: false,
	canAccessWca2fa: false,
	isSponsorshipManager: false,
	canAccessSocialMediaDashboard: false,
} as const;

export const usePermissionSnapshot = () => {
	const snapshot = useQuery(api.admin.getPermissionSnapshot, {});
	return {
		permissions: snapshot ?? DEFAULT_PERMISSION_SNAPSHOT,
		isLoading: snapshot === undefined,
	};
};

export const useIsDirector = () => {
	const { permissions, isLoading } = usePermissionSnapshot();
	return { isDirector: permissions.isDirector, isLoading };
};

export const useIsDelegate = () => {
	const { permissions, isLoading } = usePermissionSnapshot();
	return { isDelegate: permissions.isDelegate, isLoading };
};

export const useIsVolunteer = () => {
	const { permissions, isLoading } = usePermissionSnapshot();
	return { isVolunteer: permissions.isVolunteer, isLoading };
};

export const useCanAccessWca2fa = () => {
	const { permissions, isLoading } = usePermissionSnapshot();
	return { canAccess: permissions.canAccessWca2fa, isLoading };
};

export const useCanAccessSocialMediaDashboard = () => {
	const { permissions, isLoading } = usePermissionSnapshot();
	return { canAccess: permissions.canAccessSocialMediaDashboard, isLoading };
};

export const useIsSponsorshipManager = () => {
	const { permissions, isLoading } = usePermissionSnapshot();
	return { isManager: permissions.isSponsorshipManager, isLoading };
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

export const useAdminImpersonationTargets = () => {
	const d = useQuery(api.admin.listImpersonationTargets, {});
	return {
		users: d?.users ?? [],
		sponsors: d?.sponsors ?? [],
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

export function useAdminImpersonationMutations() {
	const createImpersonationLoginLink = useMutation(
		api.admin.createImpersonationLoginLink,
	);
	const consumeSponsorImpersonationTicket = useMutation(
		api.admin.consumeSponsorImpersonationTicket,
	);
	return {
		createImpersonationLoginLink,
		consumeSponsorImpersonationTicket,
	};
}
