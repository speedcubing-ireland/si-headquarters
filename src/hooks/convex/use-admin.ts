import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRetainedQueryResult } from "./use-retained-query-result";

const DEFAULT_PERMISSION_SNAPSHOT = {
	isDirector: false,
	isDelegate: false,
	isVolunteer: false,
	canAccessWca2fa: false,
	isSponsorshipManager: false,
	canAccessSocialMediaDashboard: false,
} as const;

export const usePermissionSnapshot = () => {
	const result = useQuery(api.admin.getPermissionSnapshot, {});
	const {
		data: snapshot,
		isLoading,
		isRefreshing,
	} = useRetainedQueryResult(result);
	return {
		permissions: snapshot ?? DEFAULT_PERMISSION_SNAPSHOT,
		isLoading,
		isRefreshing,
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
	const result = useQuery(api.admin.listMembersAndTeams, {});
	const { data, isLoading, isRefreshing } = useRetainedQueryResult(result);
	return {
		users: data?.users ?? [],
		teams: data?.teams ?? [],
		pendingTeamMembers: data?.pendingTeamMembers ?? [],
		isLoading,
		isRefreshing,
	};
};

export const useAdminImpersonationTargets = () => {
	const result = useQuery(api.admin.listImpersonationTargets, {});
	const { data, isLoading, isRefreshing } = useRetainedQueryResult(result);
	return {
		users: data?.users ?? [],
		sponsors: data?.sponsors ?? [],
		isLoading,
		isRefreshing,
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
